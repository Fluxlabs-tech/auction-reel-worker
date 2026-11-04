import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import pLimit from 'p-limit';
import axios from 'axios';
import { AuctionReelJob } from '../../interfaces/job.interface';
import { TranscriptWord } from '../../interfaces/transcript.interface';
import { AuctionReelJobModel } from '../../models/auctionReelJob.model';
import { env } from '../../config/env';
import { uploadToStorageService } from '../storage/uploadToStorage.service';
import { dispatchTranscriptionService } from './dispatchTranscription.service';
import { getS3ObjectService } from '../external/s3/getS3Object.service';
import { parsePlaylistService } from '../media/parsePlaylist.service';
import { ensureSegmentDownloadedService } from '../media/ensureSegmentDownloaded.service';

export const transcribeStreamAudioService = async (job: AuctionReelJob): Promise<void> => {
  let scratchDir: string;
  let segmentsDir: string;
  let audioPath: string;
  let playlistKey: string;
  let playlistBuffer: Buffer | null = null;
  let m3u8Text: string;
  let segments: any[] = [];
  let limit: any;
  let downloadedSegPaths: string[] = [];
  let concatListFile: string;
  let listContent: string;
  let ffmpegArgs: string[];
  let ffmpegProcess: any;
  let stderrData: string = '';
  let audioKey: string;
  let audioUri: string;
  let words: TranscriptWord[];
  let transcriptKey: string;
  let transcriptUri: string;

  try {
    scratchDir = path.join(env.SCRATCH_DIR, String(job.stream_id));
    if (!fs.existsSync(scratchDir)) {
      fs.mkdirSync(scratchDir, { recursive: true });
    }

    segmentsDir = path.join(scratchDir, 'segments');
    if (!fs.existsSync(segmentsDir)) {
      fs.mkdirSync(segmentsDir, { recursive: true });
    }

    audioPath = path.join(scratchDir, 'audio.mp3');

    // 1. Extract audio if not already extracted
    if (!fs.existsSync(audioPath) || fs.statSync(audioPath).size < 1024) {
      console.log(`[transcribeStreamAudioService] Extracting audio for stream ${job.stream_id}...`);

      playlistKey = `streams/${job.stream_id}/${job.stream_id}.m3u8`;
      try {
        playlistBuffer = await getS3ObjectService(playlistKey);
      } catch (err: any) {
        console.warn(
          `[transcribeStreamAudioService] Could not read playlist from S3 for stream ${job.stream_id}, trying CDN fallback...`,
        );
        try {
          const cdnRes = await axios.get(
            `https://cdn-prod.zooplive.com/streams/${job.stream_id}/${job.stream_id}.m3u8`,
            { responseType: 'arraybuffer', timeout: 10000 },
          );
          playlistBuffer = Buffer.from(cdnRes.data);
        } catch (cdnErr: any) {
          console.warn(
            `[transcribeStreamAudioService] Could not read playlist from CDN for stream ${job.stream_id}:`,
            cdnErr?.message || cdnErr,
          );
        }
      }

      if (playlistBuffer) {
        m3u8Text = playlistBuffer.toString('utf-8');
        segments = parsePlaylistService(m3u8Text, `streams/${job.stream_id}`);
      }

      if (segments.length === 0) {
        throw new Error(`No playable segments found in playlist for stream ${job.stream_id}`);
      }

      // Download segments in parallel (concurrency 16) into shared segments pool
      limit = pLimit(16);
      await Promise.all(
        segments.map((seg, idx) =>
          limit(async () => {
            const segPath = await ensureSegmentDownloadedService({
              streamId: job.stream_id,
              segKey: seg.key,
              segmentsDir,
            });
            downloadedSegPaths[idx] = segPath;
          }),
        ),
      );

      // Create concat list
      concatListFile = path.join(scratchDir, 'concat_audio.txt');
      listContent = downloadedSegPaths.map((p) => `file '${p}'`).join('\n');
      fs.writeFileSync(concatListFile, listContent, 'utf-8');

      // ffmpeg extract mono 16kHz audio (compressed mp3 at 32k for fast ASR transfer)
      ffmpegArgs = [
        '-y',
        '-f',
        'concat',
        '-safe',
        '0',
        '-i',
        concatListFile,
        '-vn',
        '-acodec',
        'libmp3lame',
        '-ar',
        '16000',
        '-ac',
        '1',
        '-b:a',
        '32k',
        audioPath,
      ];

      await new Promise<void>((resolve, reject) => {
        ffmpegProcess = spawn('ffmpeg', ffmpegArgs);
        ffmpegProcess.stderr.on('data', (d: Buffer) => {
          stderrData += d.toString();
        });
        ffmpegProcess.on('close', (code: number) => {
          if (code !== 0) {
            reject(
              new Error(
                `ffmpeg audio extraction failed with code ${code}: ${stderrData.slice(-500)}`,
              ),
            );
          } else {
            resolve();
          }
        });
        ffmpegProcess.on('error', (err: any) => reject(err));
      });
    }

    if (!fs.existsSync(audioPath) || fs.statSync(audioPath).size < 1024) {
      throw new Error(`Extracted audio file is invalid or empty for stream ${job.stream_id}`);
    }

    // 2. Upload audio to configured bucket (GCP or AWS)
    audioKey = `audio/${job.stream_id}/audio.mp3`;
    audioUri = await uploadToStorageService(audioKey, audioPath, {
      contentType: 'audio/mpeg',
    });
    console.log(
      `[transcribeStreamAudioService] Audio uploaded for stream ${job.stream_id} to ${audioUri}`,
    );

    // 3. Dispatch to Speech-to-Text provider
    words = await dispatchTranscriptionService(audioPath);

    // 4. Save transcript artifact to configured bucket (GCP or AWS)
    transcriptKey = `transcripts/${job.stream_id}/transcript.json`;
    transcriptUri = await uploadToStorageService(transcriptKey, JSON.stringify(words, null, 2), {
      contentType: 'application/json',
    });
    console.log(
      `[transcribeStreamAudioService] Transcript uploaded for stream ${job.stream_id} to ${transcriptUri}`,
    );

    // 5. Update Firestore job document
    await AuctionReelJobModel.updateTranscript(job.stream_id, {
      status: 'COMPLETED',
      source: env.STT_PROVIDER,
      storage_provider: env.STORAGE_PROVIDER,
      storage_uri: transcriptUri,
      word_count: words.length,
      completed_at: new Date().toISOString(),
    });

    console.log(
      `[transcribeStreamAudioService] Stream ${job.stream_id} transcription phase finished. Yielding worker capacity.`,
    );

    // Explicit requirement: on completion return from the function!
    return;
  } catch (error: any) {
    console.error(
      `[transcribeStreamAudioService] Error processing transcript for stream ${job.stream_id}:`,
      error?.message || error,
    );
    // Record error in Firestore so status is visible
    try {
      await AuctionReelJobModel.updateTranscript(job.stream_id, {
        status: 'FAILED',
        error: error?.message || 'Transcription failed',
      });
    } catch (_ignore: any) {
      console.warn(
        `[transcribeStreamAudioService] Could not update failed status for stream ${job.stream_id}:`,
        _ignore?.message || _ignore,
      );
    }
    throw error;
  }
};

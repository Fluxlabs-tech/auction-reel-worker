export const getStreamDateFolder = (dateIso?: string): string => {
  const d = dateIso ? new Date(dateIso) : new Date();
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

export const getStreamGcsPrefix = (streamId: number, dateIso?: string): string => {
  const dateFolder = getStreamDateFolder(dateIso);
  return `auction-reels/${dateFolder}/${streamId}/`;
};

export const getLotGcsPrefix = (
  streamId: number,
  lotNumber: number,
  auctionId: string,
  dateIso?: string,
): string => {
  const streamPrefix = getStreamGcsPrefix(streamId, dateIso);
  const lotFolder = `${String(lotNumber).padStart(2, '0')}_${auctionId}/`;
  return `${streamPrefix}${lotFolder}`;
};

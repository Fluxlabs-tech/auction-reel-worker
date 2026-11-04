import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { loadServiceAccountCredentials } from '../../src/config/loadServiceAccountCredentials';
import { env } from '../../src/config/env';

describe('loadServiceAccountCredentials', () => {
  const originalJson = env.GCP_SERVICE_ACCOUNT_JSON;
  const originalPath = env.GCP_SERVICE_ACCOUNT_KEY_PATH;
  const key = {
    type: 'service_account',
    project_id: 'zoop-test',
    client_email: 'reels@zoop-test.iam.gserviceaccount.com',
    private_key: '-----BEGIN PRIVATE KEY-----\\nabc\\n-----END PRIVATE KEY-----\\n',
  };
  const expected = {
    projectId: 'zoop-test',
    clientEmail: 'reels@zoop-test.iam.gserviceaccount.com',
    privateKey: '-----BEGIN PRIVATE KEY-----\nabc\n-----END PRIVATE KEY-----\n',
  };

  beforeEach(() => {
    env.GCP_SERVICE_ACCOUNT_JSON = undefined;
    env.GCP_SERVICE_ACCOUNT_KEY_PATH = undefined;
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterAll(() => {
    env.GCP_SERVICE_ACCOUNT_JSON = originalJson;
    env.GCP_SERVICE_ACCOUNT_KEY_PATH = originalPath;
    jest.restoreAllMocks();
  });

  it('should return null when no service account is configured', () => {
    expect(loadServiceAccountCredentials()).toBeNull();
  });

  it('should parse raw JSON and unescape private key newlines', () => {
    env.GCP_SERVICE_ACCOUNT_JSON = JSON.stringify(key);

    expect(loadServiceAccountCredentials()).toEqual(expected);
  });

  it('should parse base64-encoded JSON', () => {
    env.GCP_SERVICE_ACCOUNT_JSON = Buffer.from(JSON.stringify(key)).toString('base64');

    expect(loadServiceAccountCredentials()).toEqual(expected);
  });

  it('should read the key file when only a path is configured', () => {
    const keyPath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'sa-')), 'key.json');
    fs.writeFileSync(keyPath, JSON.stringify(key));
    env.GCP_SERVICE_ACCOUNT_KEY_PATH = keyPath;

    expect(loadServiceAccountCredentials()).toEqual(expected);
  });

  it('should fail closed on a key missing private_key', () => {
    env.GCP_SERVICE_ACCOUNT_JSON = JSON.stringify({ ...key, private_key: undefined });

    expect(() => loadServiceAccountCredentials()).toThrow(/private_key/);
  });

  it('should fail closed when the key file does not exist', () => {
    env.GCP_SERVICE_ACCOUNT_KEY_PATH = '/nonexistent/key.json';

    expect(() => loadServiceAccountCredentials()).toThrow();
  });
});

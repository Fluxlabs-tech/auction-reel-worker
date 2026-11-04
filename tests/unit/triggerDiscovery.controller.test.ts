import { Request, Response } from 'express';
import { triggerDiscoveryController } from '../../src/controller/triggerDiscovery.controller';
import * as discoveryService from '../../src/services/loops/runDiscoveryTick.service';

describe('triggerDiscoveryController', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let jsonMock: jest.Mock;
  let statusMock: jest.Mock;

  beforeEach(() => {
    jsonMock = jest.fn();
    statusMock = jest.fn().mockReturnValue({ json: jsonMock });
    mockReq = {};
    mockRes = {
      status: statusMock,
      json: jsonMock,
    };
  });

  it('should return 200 with processedCount on success', async () => {
    jest.spyOn(discoveryService, 'runDiscoveryTickService').mockResolvedValue(3);

    await triggerDiscoveryController(mockReq as Request, mockRes as Response);

    expect(statusMock).toHaveBeenCalledWith(200);
    expect(jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        processedCount: 3,
      }),
    );
  });

  it('should return 500 when discovery service throws', async () => {
    jest
      .spyOn(discoveryService, 'runDiscoveryTickService')
      .mockRejectedValue(new Error('Discovery network failure'));

    await triggerDiscoveryController(mockReq as Request, mockRes as Response);

    expect(statusMock).toHaveBeenCalledWith(500);
    expect(jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: 'Discovery network failure',
      }),
    );
  });
});

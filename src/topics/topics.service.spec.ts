import { HttpStatus } from '@nestjs/common';
import { TopicsService } from './topics.service';
import { BusinessException, ErrorCode } from '../common/errors';
import { MAX_TOPICS_PER_ITEM } from './topics.constants';

function createService(overrides?: {
  topics?: { id: string }[];
}) {
  const topicsRepository = {
    find: jest.fn().mockResolvedValue(overrides?.topics ?? []),
    findOne: jest.fn(),
  };
  const followedTopicsRepository = {
    find: jest.fn(),
    findOne: jest.fn(),
    save: jest.fn(),
    create: jest.fn((value) => value),
    remove: jest.fn(),
  };
  const postTopicsRepository = {
    find: jest.fn(),
    delete: jest.fn(),
    save: jest.fn(),
    create: jest.fn((value) => value),
  };
  const articleTopicsRepository = {
    find: jest.fn(),
    delete: jest.fn(),
    save: jest.fn(),
    create: jest.fn((value) => value),
  };

  const service = new TopicsService(
    topicsRepository as never,
    followedTopicsRepository as never,
    postTopicsRepository as never,
    articleTopicsRepository as never,
  );

  return { service, topicsRepository };
}

describe('TopicsService.resolveTopicIds', () => {
  it('returns an empty list when topicIds is omitted or empty', async () => {
    const { service, topicsRepository } = createService();

    await expect(service.resolveTopicIds(undefined)).resolves.toEqual([]);
    await expect(service.resolveTopicIds([])).resolves.toEqual([]);
    expect(topicsRepository.find).not.toHaveBeenCalled();
  });

  it('dedupes ids and rejects more than the cap', async () => {
    const { service } = createService();
    const tooMany = Array.from(
      { length: MAX_TOPICS_PER_ITEM + 1 },
      (_, index) => `00000000-0000-4000-8000-00000000000${index}`,
    );

    await expect(service.resolveTopicIds(tooMany)).rejects.toMatchObject({
      errorCode: ErrorCode.TOPIC_TOO_MANY,
      httpStatus: HttpStatus.BAD_REQUEST,
    } satisfies Partial<BusinessException>);
  });

  it('rejects unknown topic ids', async () => {
    const { service } = createService({ topics: [{ id: 'known' }] });

    await expect(
      service.resolveTopicIds(['known', 'missing']),
    ).rejects.toMatchObject({
      errorCode: ErrorCode.TOPIC_NOT_FOUND,
      httpStatus: HttpStatus.BAD_REQUEST,
    });
  });

  it('returns unique existing ids', async () => {
    const { service } = createService({
      topics: [{ id: 'a' }, { id: 'b' }],
    });

    await expect(service.resolveTopicIds(['a', 'b', 'a'])).resolves.toEqual([
      'a',
      'b',
    ]);
  });
});

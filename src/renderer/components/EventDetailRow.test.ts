import {
  aggregateEventGains,
  buildEventDetailRows,
  groupEventOptionEffects,
  parseEventGainEffects,
  shouldShowEventOptionLabel,
  splitEventGainSegments,
} from './EventDetailRow';

describe('event detail gain formatting', () => {
  it('aggregates numeric variants with the same result structure', () => {
    expect(
      aggregateEventGains([
        '根据比赛获得属性 / 体力提升[-20] / 根据比赛结果获得技能',
        '根据比赛获得属性 / 体力提升[-5] / 根据比赛结果获得技能',
        '根据比赛获得属性 / 体力提升[-10] / 根据比赛结果获得技能',
      ]),
    ).toEqual([
      '根据比赛获得属性 / 体力提升[-5/-10/-20] / 根据比赛结果获得技能',
    ]);
  });

  it('keeps structurally different results separate and removes duplicates', () => {
    expect(
      aggregateEventGains([
        '根据比赛获得属性 / 根据比赛结果获得技能',
        '根据比赛获得属性 / 体力提升[-20] / 根据比赛结果获得技能',
        '根据比赛获得属性 / 根据比赛结果获得技能',
        '根据比赛获得属性 / 体力提升[-15] / 根据比赛结果获得技能',
      ]),
    ).toEqual([
      '根据比赛获得属性 / 根据比赛结果获得技能',
      '根据比赛获得属性 / 体力提升[-15/-20] / 根据比赛结果获得技能',
    ]);
  });

  it('normalizes local event separators before aggregation', () => {
    expect(aggregateEventGains(['体力提升[10];速度提升[5]'])).toEqual([
      '体力提升[10] / 速度提升[5]',
    ]);
  });

  it('marks signed and unsigned positive values green and negatives red', () => {
    expect(splitEventGainSegments('速度提升[10/+5] / 体力提升[-10]')).toEqual([
      { text: '速度提升', tone: 'neutral' },
      { text: '[', tone: 'neutral' },
      { text: '10', tone: 'positive' },
      { text: '/', tone: 'neutral' },
      { text: '+5', tone: 'positive' },
      { text: ']', tone: 'neutral' },
      { text: ' / 体力提升', tone: 'neutral' },
      { text: '[', tone: 'neutral' },
      { text: '-10', tone: 'negative' },
      { text: ']', tone: 'neutral' },
    ]);
  });

  it('aggregates and simplifies common support-card result formats', () => {
    const gains = aggregateEventGains([
      '支援角色[美浦波旁]友情槽提升[5] / 智力提升[5] / 技能[领跑诀窍○]灵感等级提升[1]',
      '支援角色[美浦波旁]友情槽提升[10] / 智力提升[10] / 技能[领跑诀窍○]灵感等级提升[3]。',
    ]);

    expect(gains).toEqual([
      '支援角色[美浦波旁]友情槽提升[10/5] / 智力提升[10/5] / 技能[领跑诀窍○]灵感等级提升[3/1]',
    ]);
    expect(parseEventGainEffects(gains[0])).toEqual([
      {
        label: '友情槽',
        context: '美浦波旁',
        values: [
          { text: '+10', tone: 'positive' },
          { text: '/', tone: 'neutral' },
          { text: '+5', tone: 'positive' },
        ],
        accent: 'default',
      },
      {
        label: '智力',
        values: [
          { text: '+10', tone: 'positive' },
          { text: '/', tone: 'neutral' },
          { text: '+5', tone: 'positive' },
        ],
        accent: 'default',
      },
      {
        label: '灵感',
        context: '领跑诀窍○',
        values: [
          { text: 'Lv3', tone: 'positive' },
          { text: '/', tone: 'neutral' },
          { text: 'Lv1', tone: 'positive' },
        ],
        accent: 'buff',
      },
    ]);
  });

  it('shows unsigned decreases as negative values', () => {
    expect(parseEventGainEffects('速度降低[5]')).toEqual([
      {
        label: '速度',
        values: [{ text: '-5', tone: 'negative' }],
        accent: 'default',
      },
    ]);
  });

  it('marks acquired skills as good buffs', () => {
    expect(parseEventGainEffects('技能[才能出众]')).toEqual([
      {
        label: '才能出众',
        context: '技能',
        values: [],
        accent: 'buff',
      },
    ]);
  });

  it('moves effects shared by every option into a common group', () => {
    expect(
      groupEventOptionEffects([
        {
          option: '选项1',
          gainList: [
            '干劲提升[1] / 速度提升[5] / 支援角色[丸善斯基]友情槽提升[5]',
          ],
        },
        {
          option: '选项2',
          gainList: [
            '干劲提升[1] / 智力提升[5] / 支援角色[丸善斯基]友情槽提升[5]',
          ],
        },
      ]),
    ).toEqual({
      commonEffects: [
        {
          label: '干劲',
          values: [{ text: '+1', tone: 'positive' }],
          accent: 'default',
        },
        {
          label: '友情槽',
          context: '丸善斯基',
          values: [{ text: '+5', tone: 'positive' }],
          accent: 'default',
        },
      ],
      options: [
        {
          option: '选项1',
          gainList: [
            '干劲提升[1] / 速度提升[5] / 支援角色[丸善斯基]友情槽提升[5]',
          ],
          branches: [
            [
              {
                label: '速度',
                values: [{ text: '+5', tone: 'positive' }],
                accent: 'default',
              },
            ],
          ],
        },
        {
          option: '选项2',
          gainList: [
            '干劲提升[1] / 智力提升[5] / 支援角色[丸善斯基]友情槽提升[5]',
          ],
          branches: [
            [
              {
                label: '智力',
                values: [{ text: '+5', tone: 'positive' }],
                accent: 'default',
              },
            ],
          ],
        },
      ],
    });
  });

  it('hides empty option placeholders', () => {
    expect(shouldShowEventOptionLabel('无选项')).toBe(false);
    expect(shouldShowEventOptionLabel('（无选项）')).toBe(false);
    expect(shouldShowEventOptionLabel('')).toBe(false);
    expect(shouldShowEventOptionLabel('选项1')).toBe(true);
  });

  it('does not build an event row without a real option', () => {
    expect(
      buildEventDetailRows(
        [
          {
            eventId: 100,
            eventName: '无数据事件',
            options: [
              {
                desp: '无选项',
                detail: '',
                type: 'unknown',
              },
            ],
          },
        ],
        {},
      ),
    ).toEqual([]);
  });
});

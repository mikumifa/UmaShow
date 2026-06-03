import React from 'react';
import { ArrowLeft, Download, FileText } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import type { NavigateFunction } from 'react-router-dom';
import RaceDataPresenter from 'renderer/components/RaceDataPresenter';
import type { RaceMetaInfo } from 'types/gameTypes';
import { RaceSimulateData } from 'umdb/race_data_pb';
import { deserializeFromBase64 } from 'umdb/RaceDataParser';
import { loadUMDB, UMDB } from 'renderer/utils/umdb';
import RacePageLayout, {
  raceHeaderButtonClass,
} from 'renderer/components/RacePageLayout';

// 1. Props 定义：只接收路由跳转过来的参数
type RaceDataPageProps = {
  initialValues?: {
    scenario?: string;
    horseInfo?: string;
    raceMetaInfo?: RaceMetaInfo;
    archiveId?: string;
  };
  navigate: NavigateFunction; // 传入 navigate 函数以便支持返回操作
};

// 2. State 定义：不再需要 input 字符串，只需要解析后的对象
type RaceDataPageState = {
  parsedHorseInfo: any;
  parsedRaceData: RaceSimulateData | undefined;
  error?: string; // 增加一个错误状态，万一解析失败显示提示
  showLegacyPage: boolean;
};

class RaceDataPageClass extends React.Component<
  RaceDataPageProps,
  RaceDataPageState
> {
  constructor(props: RaceDataPageProps) {
    super(props);
    this.state = {
      parsedHorseInfo: undefined,
      parsedRaceData: undefined,
      error: undefined,
      showLegacyPage: true,
    };
  }

  async componentDidMount() {
    const { initialValues } = this.props;
    await loadUMDB();
    if (!initialValues || !initialValues.scenario) {
      this.setState({
        error: '未提供比赛数据，请从比赛记录页打开。',
      });
      return;
    }
    const { scenario, horseInfo } = initialValues;
    try {
      const parsedData = deserializeFromBase64(scenario.trim());
      let parsedHorse = undefined;
      if (horseInfo) {
        try {
          parsedHorse = JSON.parse(horseInfo);
        } catch (e) {
          console.warn('Horse info parse warning:', e);
        }
      }

      this.setState({
        parsedRaceData: parsedData,
        parsedHorseInfo: parsedHorse,
      });
    } catch (e) {
      console.error('Parse error:', e);
      this.setState({
        error: '比赛数据解析失败，数据格式可能无效。',
      });
    }
  }

  downloadParsedRaceData = () => {
    const { parsedRaceData } = this.state;
    if (!parsedRaceData) return;

    const raceInstanceId =
      this.props.initialValues?.raceMetaInfo?.race_instance_id ?? 'unknown';
    const payload = parsedRaceData.toJson();
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    const timestamp = new Date()
      .toISOString()
      .replace(/[:.]/g, '-')
      .replace('T', '_')
      .replace('Z', '');

    anchor.href = url;
    anchor.download = `race_data_${raceInstanceId}_${timestamp}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  };

  render() {
    const archiveId = this.props.initialValues?.archiveId ?? 'default';
    const isDetailPage = this.state.showLegacyPage;
    const pageTitle = isDetailPage ? '比赛详情' : '比赛回放';
    const pageDescription = isDetailPage
      ? '查看出赛表、曲线和事件分析'
      : '查看比赛过程回放';
    const backToRaces = () =>
      this.props.navigate('/races', { state: { archiveId } });

    if (this.state.error) {
      return (
        <RacePageLayout
          title={pageTitle}
          description={pageDescription}
          icon={<FileText size={20} />}
          actions={
            <button
              type="button"
              onClick={backToRaces}
              className={raceHeaderButtonClass}
            >
              <ArrowLeft size={16} />
              返回记录
            </button>
          }
        >
          <div className="rounded-lg border border-red-200 bg-white px-4 py-10 text-center text-red-600">
            {this.state.error}
          </div>
        </RacePageLayout>
      );
    }

    if (this.state.parsedRaceData) {
      return (
        <RacePageLayout
          title={pageTitle}
          description={pageDescription}
          icon={<FileText size={20} />}
          actions={
            <>
              <button
                type="button"
                onClick={this.downloadParsedRaceData}
                className={raceHeaderButtonClass}
              >
                <Download size={16} />
                导出 RaceData JSON
              </button>
              <button
                type="button"
                onClick={() =>
                  this.setState((state) => ({
                    showLegacyPage: !state.showLegacyPage,
                  }))
                }
                className={raceHeaderButtonClass}
              >
                <FileText size={16} />
                {isDetailPage ? '回放' : '返回详细'}
              </button>
              <button
                type="button"
                onClick={backToRaces}
                className={raceHeaderButtonClass}
              >
                <ArrowLeft size={16} />
                返回记录
              </button>
            </>
          }
        >
          <RaceDataPresenter
            raceHorseInfo={this.state.parsedHorseInfo}
            raceData={this.state.parsedRaceData}
            raceMetaInfo={this.props.initialValues?.raceMetaInfo}
            umdb={UMDB}
            showLegacyPage={this.state.showLegacyPage}
          />
        </RacePageLayout>
      );
    }

    return (
      <RacePageLayout
        title={pageTitle}
        description={pageDescription}
        icon={<FileText size={20} />}
        actions={
          <button
            type="button"
            onClick={backToRaces}
            className={raceHeaderButtonClass}
          >
            <ArrowLeft size={16} />
            返回记录
          </button>
        }
      >
        <div className="rounded-lg border border-gray-200 bg-white px-4 py-10 text-center text-gray-400">
          Loading and parsing data...
        </div>
      </RacePageLayout>
    );
  }
}

// 导出包装组件
export default function RaceDataPage() {
  const location = useLocation();
  const navigate = useNavigate(); // 获取 navigate
  const state = location.state as {
    scenario?: string;
    horseInfo?: string;
    raceMetaInfo?: RaceMetaInfo;
    archiveId?: string;
  } | null;

  return (
    <RaceDataPageClass initialValues={state || undefined} navigate={navigate} />
  );
}

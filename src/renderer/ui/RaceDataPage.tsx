import React from 'react';
import { Button } from 'react-bootstrap'; // 保留 Button 用于做一个“返回”按钮
import { useLocation, useNavigate } from 'react-router-dom';
import RaceDataPresenter from 'renderer/components/RaceDataPresenter';
import { RaceSimulateData } from 'umdb/race_data_pb';
import { deserializeFromBase64 } from 'umdb/RaceDataParser';
import { loadUMDB, UMDB } from 'renderer/utils/umdb';

// 1. Props 定义：只接收路由跳转过来的参数
type RaceDataPageProps = {
  initialValues?: {
    scenario?: string;
    horseInfo?: string;
  };
  navigate: (path: string) => void; // 传入 navigate 函数以便支持返回操作
};

// 2. State 定义：不再需要 input 字符串，只需要解析后的对象
type RaceDataPageState = {
  parsedHorseInfo: any;
  parsedRaceData: RaceSimulateData | undefined;
  error?: string; // 增加一个错误状态，万一解析失败显示提示
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
    };
  }

  async componentDidMount() {
    const { initialValues } = this.props;
    await loadUMDB();
    if (!initialValues || !initialValues.scenario) {
      this.setState({
        error: 'No race data provided. Please start from the Dashboard.',
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
        error: 'Failed to parse race data. Format might be invalid.',
      });
    }
  }

  render() {
    if (this.state.error) {
      return (
        <div className="p-4 text-center">
          <h3 className="text-danger">Error</h3>
          <p>{this.state.error}</p>
          <Button variant="secondary" onClick={() => this.props.navigate('/')}>
            Back to Dashboard
          </Button>
        </div>
      );
    }

    if (this.state.parsedRaceData) {
      return (
        <div className="p-2">
          <RaceDataPresenter
            raceHorseInfo={this.state.parsedHorseInfo}
            raceData={this.state.parsedRaceData}
            umdb={UMDB}
          />
        </div>
      );
    }

    return <div className="p-4 text-center">Loading and parsing data...</div>;
  }
}

// 导出包装组件
export default function RaceDataPage() {
  const location = useLocation();
  const navigate = useNavigate(); // 获取 navigate
  const state = location.state as {
    scenario?: string;
    horseInfo?: string;
  } | null;

  return (
    <RaceDataPageClass initialValues={state || undefined} navigate={navigate} />
  );
}

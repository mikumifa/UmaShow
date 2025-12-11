function FailureRateBadge({ failureRate }: { failureRate: number }) {
  const getStyleConfig = (rate: number) => {
    if (rate >= 50) {
      return {
        bg: 'bg-[#ff3c00]', // 赛马娘风格的亮红
        labelColor: 'text-white',
        numColor: 'text-[#ffeb3b]', // 亮黄
        borderColor: 'border-white/20',
      };
    }
    if (rate >= 20) {
      return {
        bg: 'bg-[#ff9800]',
        labelColor: 'text-white',
        numColor: 'text-white',
        borderColor: 'border-white/20',
      };
    }
    return {
      bg: 'bg-[#2196f3]',
      labelColor: 'text-white',
      numColor: 'text-white',
      borderColor: 'border-white/20',
    };
  };

  // 如果失败率为0，通常不显示（根据你的原有逻辑）
  if (failureRate <= 0) return null;

  const style = getStyleConfig(failureRate);

  return (
    <div className="absolute -top-5 -right-2 z-20 flex flex-col items-center animate-bounce-slight">
      {/* 气泡主体 */}
      <div
        className={`
          ${style.bg}
          ${style.borderColor}
          relative px-2 py-0.5 rounded-full border shadow-sm
          flex items-center gap-1 min-w-[60px] justify-center
        `}
      >
        {/* "失败率" 标签 */}
        <span
          className={`${style.labelColor} text-[10px] font-bold tracking-tight`}
        >
          失败率
        </span>

        {/* 具体数值 */}
        <span
          className={`${style.numColor} text-[11px] font-extrabold font-mono`}
        >
          {failureRate}%
        </span>

        {/* 气泡底部的小尾巴 (用旋转的方形模拟) */}
        <div
          className={`
            absolute -bottom-1 left-1/2 -translate-x-1/2
            w-2 h-2 rotate-45
            ${style.bg}
          `}
        />
      </div>
    </div>
  );
}

export default FailureRateBadge;

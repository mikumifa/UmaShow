import { useEffect, useState } from 'react';

function GameStartScreen() {
  const [img, setImg] = useState<string>('');
  useEffect(() => {
    // eslint-disable-next-line promise/catch-or-return
    window.electron.utils
      .getFile('start.png')
      // eslint-disable-next-line promise/always-return
      .then((base64) => {
        setImg(base64);
      });
  }, []);
  return (
    <div className="flex flex-col items-center w-full min-h-screen bg-gradient-to-b from-blue-50 to-blue-100 overflow-y-auto font-sans relative">
      {/* 背景装饰 */}
      <div className="absolute inset-0 opacity-10 pointer-events-none">
        <div className="absolute top-10 left-10 w-20 h-20 rounded-full bg-blue-300 blur-xl" />
        <div className="absolute bottom-20 right-10 w-32 h-32 rounded-full bg-green-300 blur-xl" />
        <div className="w-full h-full bg-[linear-gradient(45deg,transparent_25%,rgba(255,255,255,0.5)_50%,transparent_75%,transparent_100%)] bg-[length:20px_20px]" />
      </div>

      {/* 顶部标题 */}
      <div className="mt-12 z-10 text-center animate-fade-in-down">
        <h1 className="text-3xl font-extrabold text-slate-800 tracking-wider drop-shadow-sm">
          READY?
        </h1>
        <p className="text-blue-500 font-bold text-lg mt-1 tracking-widest uppercase">
          Uma Musume
        </p>
      </div>

      {/* 中间图片区 */}
      <div className="flex flex-col flex-1 items-center justify-center z-10 relative mt-6 mb-6">
        <div className="absolute w-52 h-52 bg-white rounded-full opacity-60 blur-2xl animate-pulse" />
        <div className="relative transition-transform hover:scale-110 duration-300 cursor-pointer">
          <img
            src={img}
            alt="Grass Wonder"
            className="w-52 sm:w-64 h-auto drop-shadow-2xl object-contain"
          />
          <div className="absolute -top-4 -right-4 bg-white px-3 py-1 rounded-tr-xl rounded-bl-xl rounded-tl-xl border-2 border-blue-400 shadow-lg animate-bounce">
            <span className="text-sm font-bold text-slate-700">加油哦！</span>
          </div>
        </div>
      </div>

      <div className="mb-16 z-10 w-full px-8 flex flex-col items-center">
        <div className="w-full max-w-md bg-white/80 backdrop-blur-md border border-blue-300 rounded-xl px-4 py-3 shadow-md flex items-center gap-3">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-6 w-6 text-blue-500 flex-shrink-0"
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <path d="M12 2a10 10 0 100 20 10 10 0 000-20zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
          </svg>

          <span className="text-slate-700 font-semibold tracking-wide">
            请先开启游戏，我们将自动开始监听数据。
          </span>
        </div>
      </div>
    </div>
  );
}

export default GameStartScreen;

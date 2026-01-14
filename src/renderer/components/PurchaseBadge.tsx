export default function PurchaseBadge({ label = '可购' }: { label?: string }) {
  return (
    <div className="absolute -top-5 -right-2 z-20 pointer-events-none flex flex-col items-center animate-bounce-slight">
      <div
        className="
          bg-emerald-500 text-white border border-white/20 rounded-full px-2 py-0.5
          text-[10px] font-bold shadow-sm min-w-[44px] text-center
        "
      >
        {label}
      </div>
      <div className="w-2 h-2 rotate-45 bg-emerald-500 -mt-1" />
    </div>
  );
}

import React from "react";

export default function StatsCard({ title, value, subtitle, icon: Icon, color = "#33A19A" }) {
  return (
    <div className="bg-white rounded-xl p-5 border border-[#B7CAC9]/20 hover:shadow-lg transition-all duration-300">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-[#3E4C59] uppercase tracking-wider">{title}</p>
          <p className="text-2xl font-heading font-bold mt-1" style={{ color }}>{value}</p>
          {subtitle && <p className="text-xs text-[#3E4C59] mt-1">{subtitle}</p>}
        </div>
        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${color}15` }}>
          <Icon className="w-5 h-5" style={{ color }} />
        </div>
      </div>
    </div>
  );
}
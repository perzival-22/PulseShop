import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

// Dummy data matching your screenshot's timeline
const mockData = [
  { name: 'Sat', total: 0 },
  { name: 'Sun', total: 0 },
  { name: 'Mon', total: 0 },
  { name: 'Tue', total: 0 },
  { name: 'Wed', total: 58 }, // Matches your Ksh 58 revenue!
  { name: 'Thu', total: 0 },
  { name: 'Fri', total: 0 },
];

export function RevenueChart({ data = mockData }) {
  return (
    // The fixed height ensures it fits nicely in your card
    <div className="h-full w-full pt-2">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#0d9488" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#0d9488" stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis 
            dataKey="name" 
            stroke="#9ca3af" 
            fontSize={12} 
            tickLine={false} 
            axisLine={false} 
          />
          <YAxis 
            stroke="#9ca3af" 
            fontSize={12} 
            tickLine={false} 
            axisLine={false} 
            tickFormatter={(value) => `Ksh ${value}`}
          />
          <Tooltip 
            formatter={(value: number) => [`Ksh ${value}`, "Revenue"]}
            contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
            labelStyle={{ color: '#374151', fontWeight: 'bold' }}
          />
          <Area
            type="monotone"
            dataKey="total"
            stroke="#0d9488" // Tailwind Teal-600 to match your UI
            strokeWidth={2}
            fillOpacity={1}
            fill="url(#colorTotal)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
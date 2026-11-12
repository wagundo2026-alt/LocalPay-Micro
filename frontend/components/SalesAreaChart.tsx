'use client';

import {
  Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis,
} from 'recharts';

type SalesDay = { day: string; sales: number };
const currency=(value:number)=>new Intl.NumberFormat('en-ZA',{style:'currency',currency:'ZAR'}).format(value);

/** Loaded only when charts have data; keeps Recharts out of ordinary merchant page bundles. */
export default function SalesAreaChart({
  days, variant='overview',
}: { days: SalesDay[]; variant?: 'overview'|'analytics' }) {
  return <ResponsiveContainer width="100%" height="100%">
    <AreaChart data={days}>
      <defs>
        <linearGradient id={'lpChart-'+variant} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#10b981" stopOpacity={0.26}/>
          <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
        </linearGradient>
      </defs>
      <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="#e6edf0"/>
      <XAxis dataKey="day" axisLine={false} tickLine={false}
        tick={{fontSize:11,fill:'#7c909a'}}/>
      <Tooltip formatter={(value: unknown)=>currency(Number(value)||0)}/>
      <Area dataKey="sales" type="monotone" stroke="#059669"
        strokeWidth={3} fill={'url(#lpChart-'+variant+')'}/>
    </AreaChart>
  </ResponsiveContainer>;
}

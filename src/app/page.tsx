// app/page.tsx
// src/app/page.tsx
'use client';

import dynamic from 'next/dynamic';

// 🔁 Import dynamique de ton landing
const HomeLanding = dynamic(() => import('../components/HomeLanding'), { ssr: false });

export default HomeLanding;


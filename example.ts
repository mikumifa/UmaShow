import React, { useState, useEffect, useRef, useMemo } from 'react';

// --- 赛马选手配置 (基于 9 匹真实参赛马) ---
const HORSES = [
  { id: 0, name: "北部玄驹 (Kitasan Black)", style: "逃 (Nige)", color: "#ef4444", textColor: "text-red-400" },
  { id: 1, name: "特别周 (Special Week)", style: "逃 (Nige)", color: "#3b82f6", textColor: "text-blue-400" },
  { id: 2, name: "神鹰 (El Condor Pasa)", style: "先 (Senko)", color: "#10b981", textColor: "text-emerald-400" },
  { id: 3, name: "无声铃鹿 (Silence Suzuka)", style: "逃 (Nige)", color: "#f59e0b", textColor: "text-amber-400" }, // 冠军马
  { id: 4, name: "草上飞 (Grass Wonder)", style: "逃 (Nige)", color: "#ec4899", textColor: "text-pink-400" },
  { id: 5, name: "大震撼 (Deep Impact)", style: "先 (Senko)", color: "#8b5cf6", textColor: "text-purple-400" },
  { id: 6, name: "黄金船 (Gold Ship)", style: "逃 (Nige)", color: "#06b6d4", textColor: "text-cyan-400" },
  { id: 7, name: "东海帝皇 (Tokai Teio)", style: "先 (Senko)", color: "#f97316", textColor: "text-orange-400" },
  { id: 8, name: "目白麦昆 (Mejiro McQueen)", style: "先 (Senko)", color: "#14b8a6", textColor: "text-teal-400" }
];

// --- 真实技能字典映射 (将 JSON 中的 Skill ID 映射为易读技能名) ---
const SKILL_DICTIONARY = {
  201101: "轻快步伐 (速度提升)",
  201102: "轻快步伐 (中段维持)",
  200452: "一锤定音 (末脚加速)",
  201262: "直线技巧 (并排突围)",
  201271: "直线技巧 (极速狂奔)",
  201601: "尾流利用 (借力滑跑)",
  210052: "弯道控制 (离心优化)",
  202531: "末脚爆发 (全力输出)",
  202532: "末脚爆发 (耐力突破)",
  202551: "终点超车 (最后直道)",
  200362: "深呼吸 (耐力回复)",
  200721: "弯道滑跑 (省力过弯)",
  910261: "绝对占位 (卡位压制)",
  201241: "起步爆发 (金卡启动)",
  200532: "专注力 (反应提升)",
  200542: "专注力 (占位抢道)"
};

// --- 真实完赛成绩榜单 (从 JSON 的 horseResult 提取) ---
const HORSE_RESULTS = [
  { id: 3, order: "1st", time: "117.58s", spurt: "1334.6m", style: "逃げ" },
  { id: 5, order: "2nd", time: "117.77s", spurt: "1335.8m", style: "先行" },
  { id: 6, order: "3rd", time: "118.20s", spurt: "1334.9m", style: "逃げ" },
  { id: 0, order: "4th", time: "118.26s", spurt: "1335.0m", style: "逃げ" },
  { id: 7, order: "5th", time: "118.35s", spurt: "1335.8m", style: "逃げ" },
  { id: 4, order: "6th", time: "118.60s", spurt: "1335.5m", style: "逃げ" },
  { id: 8, order: "7th", time: "118.60s", spurt: "1334.7m", style: "先行" },
  { id: 1, order: "8th", time: "118.70s", spurt: "1335.9m", style: "逃げ" },
  { id: 2, order: "9th", time: "118.86s", spurt: "1334.8m", style: "先行" }
];

// --- 真实技能触发事件流 (增加了 duration 持续时间属性，秒) ---
const REAL_SKILL_EVENTS = [
  { time: 0.666, horseIndex: 6, skillId: 200452, duration: 3.5 },
  { time: 1.132, horseIndex: 4, skillId: 201262, duration: 4.0 },
  { time: 1.132, horseIndex: 6, skillId: 201262, duration: 4.0 },
  { time: 1.132, horseIndex: 7, skillId: 201262, duration: 4.0 },
  { time: 1.132, horseIndex: 7, skillId: 201601, duration: 3.0 },
  { time: 1.531, horseIndex: 5, skillId: 200362, duration: 2.0 },
  { time: 2.264, horseIndex: 6, skillId: 210052, duration: 5.0 },
  { time: 5.061, horseIndex: 4, skillId: 201271, duration: 4.5 },
  { time: 5.061, horseIndex: 5, skillId: 201591, duration: 4.0 },
  { time: 5.927, horseIndex: 4, skillId: 200452, duration: 3.5 },
  { time: 6.060, horseIndex: 3, skillId: 201102, duration: 5.0 },
  { time: 6.992, horseIndex: 5, skillId: 100301111, duration: 4.0 },
  { time: 7.192, horseIndex: 1, skillId: 201271, duration: 4.5 },
  { time: 8.391, horseIndex: 1, skillId: 200452, duration: 3.5 },
  { time: 9.323, horseIndex: 7, skillId: 201271, duration: 4.5 },
  { time: 10.056, horseIndex: 0, skillId: 201282, duration: 4.0 },
  { time: 10.189, horseIndex: 3, skillId: 200452, duration: 3.5 },
  { time: 11.122, horseIndex: 1, skillId: 201241, duration: 2.5 },
  { time: 11.854, horseIndex: 6, skillId: 201271, duration: 4.5 },
  { time: 15.517, horseIndex: 3, skillId: 210052, duration: 5.0 },
  { time: 17.782, horseIndex: 7, skillId: 200721, duration: 4.0 },
  { time: 18.981, horseIndex: 6, skillId: 910261, duration: 6.0 },
  { time: 19.047, horseIndex: 4, skillId: 910261, duration: 6.0 },
  { time: 21.978, horseIndex: 5, skillId: 100301211, duration: 4.0 },
  { time: 22.244, horseIndex: 4, skillId: 210261, duration: 5.0 },
  { time: 22.377, horseIndex: 4, skillId: 202532, duration: 4.5 },
  { time: 23.509, horseIndex: 7, skillId: 202531, duration: 4.5 },
  { time: 26.307, horseIndex: 3, skillId: 103102211, duration: 4.0 },
  { time: 26.440, horseIndex: 8, skillId: 202371, duration: 3.5 },
  { time: 27.572, horseIndex: 2, skillId: 210261, duration: 5.0 },
  { time: 27.572, horseIndex: 8, skillId: 210261, duration: 5.0 },
  { time: 27.905, horseIndex: 1, skillId: 103102211, duration: 4.0 },
  { time: 30.836, horseIndex: 6, skillId: 202531, duration: 4.5 },
  { time: 32.500, horseIndex: 7, skillId: 103102211, duration: 4.0 },
  { time: 32.567, horseIndex: 7, skillId: 201611, duration: 3.5 },
  { time: 33.433, horseIndex: 7, skillId: 210261, duration: 5.0 },
  { time: 34.232, horseIndex: 2, skillId: 202372, duration: 3.5 },
  { time: 34.232, horseIndex: 7, skillId: 201111, duration: 4.0 },
  { time: 35.165, horseIndex: 3, skillId: 202391, duration: 3.5 },
  { time: 37.163, horseIndex: 3, skillId: 110311, duration: 3.0 },
  { time: 37.296, horseIndex: 6, skillId: 201661, duration: 3.5 },
  { time: 37.762, horseIndex: 2, skillId: 100301211, duration: 4.0 },
  { time: 39.161, horseIndex: 5, skillId: 202532, duration: 4.5 },
  { time: 40.093, horseIndex: 6, skillId: 106802111, duration: 4.0 },
  { time: 40.892, horseIndex: 5, skillId: 201321, duration: 3.5 },
  { time: 41.225, horseIndex: 1, skillId: 210261, duration: 5.0 },
  { time: 41.225, horseIndex: 5, skillId: 210261, duration: 5.0 },
  { time: 43.557, horseIndex: 3, skillId: 201271, duration: 4.5 },
  { time: 43.557, horseIndex: 3, skillId: 210261, duration: 5.0 },
  { time: 44.022, horseIndex: 5, skillId: 201101, duration: 4.0 },
  { time: 44.289, horseIndex: 3, skillId: 201241, duration: 2.5 },
  { time: 46.020, horseIndex: 5, skillId: 202372, duration: 3.5 },
  { time: 48.018, horseIndex: 6, skillId: 201651, duration: 4.0 },
  { time: 48.818, horseIndex: 8, skillId: 201101, duration: 4.0 },
  { time: 49.217, horseIndex: 0, skillId: 201271, duration: 4.5 },
  { time: 49.484, horseIndex: 4, skillId: 201101, duration: 4.0 },
  { time: 51.948, horseIndex: 1, skillId: 202531, duration: 4.5 },
  { time: 52.481, horseIndex: 2, skillId: 201311, duration: 3.5 },
  { time: 53.613, horseIndex: 0, skillId: 200542, duration: 3.0 },
  { time: 53.946, horseIndex: 4, skillId: 201651, duration: 4.0 },
  { time: 56.544, horseIndex: 5, skillId: 201311, duration: 3.5 },
  { time: 58.541, horseIndex: 1, skillId: 202551, duration: 4.0 },
  { time: 59.740, horseIndex: 0, skillId: 910261, duration: 6.0 },
  { time: 60.739, horseIndex: 8, skillId: 100301211, duration: 4.0 },
  { time: 61.205, horseIndex: 3, skillId: 202531, duration: 4.5 },
  { time: 65.068, horseIndex: 8, skillId: 202531, duration: 4.5 },
  { time: 66.467, horseIndex: 2, skillId: 202532, duration: 4.5 },
  { time: 66.467, horseIndex: 3, skillId: 900201, duration: 3.0 },
  { time: 66.467, horseIndex: 3, skillId: 910681, duration: 5.5 },
  { time: 66.667, horseIndex: 0, skillId: 910681, duration: 5.5 },
  { time: 66.800, horseIndex: 5, skillId: 200492, duration: 3.5 },
  { time: 67.799, horseIndex: 4, skillId: 202551, duration: 4.0 },
  { time: 67.932, horseIndex: 5, skillId: 900011, duration: 3.0 },
  { time: 67.998, horseIndex: 2, skillId: 202551, duration: 4.0 },
  { time: 68.598, horseIndex: 3, skillId: 202551, duration: 4.0 },
  { time: 70.729, horseIndex: 5, skillId: 201901, duration: 3.5 },
  { time: 73.526, horseIndex: 8, skillId: 201111, duration: 4.0 },
  { time: 75.124, horseIndex: 0, skillId: 202551, duration: 4.0 },
  { time: 78.254, horseIndex: 0, skillId: 201251, duration: 3.5 },
  { time: 78.587, horseIndex: 6, skillId: 910151, duration: 5.0 },
  { time: 81.917, horseIndex: 7, skillId: 202551, duration: 4.0 },
  { time: 82.583, horseIndex: 1, skillId: 210101, duration: 3.5 },
  { time: 82.716, horseIndex: 2, skillId: 200511, duration: 3.0 },
  { time: 84.315, horseIndex: 5, skillId: 202551, duration: 4.0 },
  { time: 84.781, horseIndex: 1, skillId: 200511, duration: 3.0 },
  { time: 88.111, horseIndex: 7, skillId: 201101, duration: 4.0 },
  { time: 88.510, horseIndex: 1, skillId: 200362, duration: 2.0 },
  { time: 89.243, horseIndex: 8, skillId: 202551, duration: 4.0 },
  { time: 90.975, horseIndex: 8, skillId: 200362, duration: 2.0 },
  { time: 91.241, horseIndex: 2, skillId: 200362, duration: 2.0 },
  { time: 92.639, horseIndex: 6, skillId: 202551, duration: 4.0 },
  { time: 94.171, horseIndex: 1, skillId: 201101, duration: 4.0 }
];

// --- 真实遥测帧样本 (时间, [d0, l0, s0, h0], ...) ---
const REAL_TELEM_SAMPLES = [
  [0.0, [0.0, 0, 300, 2461], [0.0, 555, 300, 2593], [0.0, 1111, 300, 2518], [0.0, 1666, 300, 2625], [0.0, 2222, 300, 2532], [0.0, 2777, 300, 2492], [0.0, 3333, 300, 2598], [0.0, 3888, 300, 2605], [0.0, 4444, 300, 2500]],
  [0.06, [0.14, 0, 467, 2460], [0.14, 555, 464, 2591], [0.0, 1111, 300, 2518], [0.13, 1666, 465, 2624], [0.0, 2222, 300, 2532], [0.14, 2777, 463, 2491], [0.0, 3333, 300, 2598], [0.27, 3888, 464, 2604], [0.03, 4444, 462, 2499]],
  [0.13, [0.57, 0, 635, 2459], [0.56, 555, 628, 2590], [0.22, 1111, 462, 2517], [0.55, 1666, 631, 2622], [0.25, 2222, 464, 2530], [0.56, 2777, 626, 2491], [0.21, 3333, 467, 2596], [0.69, 3888, 628, 2603], [0.45, 4444, 625, 2498]],
  [0.19, [1.10, 0, 803, 2457], [1.09, 555, 793, 2589], [0.63, 1111, 625, 2516], [1.08, 1666, 797, 2621], [0.67, 2222, 628, 2529], [1.09, 2777, 789, 2490], [0.63, 3333, 635, 2595], [1.22, 3888, 793, 2601], [0.98, 4444, 788, 2497]],
  [0.26, [1.75, 0, 971, 2456], [1.73, 555, 957, 2587], [1.16, 1111, 788, 2515], [1.72, 1666, 963, 2620], [1.19, 2222, 793, 2528], [1.72, 2777, 952, 2489], [1.17, 3333, 803, 2594], [1.86, 3888, 957, 2600], [1.61, 4444, 951, 2496]],
  [0.33, [2.51, 0, 1138, 2455], [2.48, 555, 1122, 2586], [1.79, 1111, 951, 2515], [2.47, 1666, 1128, 2618], [1.83, 2222, 957, 2526], [2.46, 2777, 1115, 2488], [1.81, 3333, 970, 2592], [2.60, 3888, 1121, 2599], [2.35, 4444, 1114, 2496]],
  [0.39, [3.38, 0, 1306, 2453], [3.33, 555, 1286, 2585], [2.54, 1111, 1114, 2514], [3.34, 1666, 1294, 2617], [2.58, 2222, 1122, 2525], [3.32, 2777, 1278, 2487], [2.57, 3333, 1138, 2591], [3.46, 3888, 1286, 2597], [3.20, 4444, 1277, 2495]],
  [0.46, [4.36, 0, 1474, 2452], [4.30, 555, 1450, 2583], [3.39, 1111, 1277, 2513], [4.31, 1666, 1460, 2616], [3.44, 2222, 1286, 2524], [4.28, 2777, 1441, 2487], [3.44, 3333, 1306, 2590], [4.43, 3888, 1450, 2596], [4.16, 4444, 1440, 2494]],
  [0.53, [5.45, 0, 1642, 2451], [5.37, 555, 1615, 2582], [4.35, 1111, 1440, 2512], [5.39, 1666, 1626, 2614], [4.40, 2222, 1451, 2522], [5.34, 2777, 1604, 2486], [4.42, 3333, 1474, 2588], [5.50, 3888, 1614, 2595], [5.23, 4444, 1603, 2493]],
  [1.06, [14.8, 0, 1798, 2443], [14.7, 555, 1776, 2575], [13.5, 1123, 1767, 2508], [14.7, 1665, 1787, 2607], [13.6, 2222, 1775, 2515], [14.6, 2777, 1769, 2481], [13.7, 3333, 1790, 2581], [14.8, 3887, 1777, 2587], [14.5, 4444, 1769, 2489]],
  [2.13, [34.7, 0, 1925, 2426], [34.0, 555, 1849, 2560], [32.6, 1123, 1788, 2499], [34.3, 1665, 1882, 2591], [33.0, 2222, 1849, 2499], [33.8, 2777, 1821, 2469], [33.5, 3333, 1916, 2564], [34.3, 3887, 1870, 2572], [33.6, 4444, 1796, 2480]],
  [3.19, [5.9, 0, 2036, 2406], [54.2, 492, 1923, 2542], [51.6, 1207, 1788, 2490], [54.8, 1610, 1962, 2572], [53.1, 2222, 1924, 2482], [53.5, 2777, 1872, 2453], [54.4, 3333, 2003, 2544], [54.7, 4140, 1948, 2553], [52.7, 4295, 1789, 2471]],
  [4.26, [78.2, 0, 2141, 2381], [75.1, 165, 1996, 2522], [70.7, 1545, 1788, 2482], [76.2, 1280, 2036, 2551], [74.0, 2222, 1997, 2462], [73.7, 2777, 1923, 2435], [75.8, 3598, 2016, 2522], [75.8, 4732, 2020, 2533], [72.0, 4223, 1835, 2457]],
  [5.32, [101.5, 0, 2208, 2352], [96.4, 0, 1998, 2501], [90.0, 1161, 1839, 2466], [98.3, 887, 2101, 2527], [95.4, 2222, 2023, 2440], [94.5, 2777, 1975, 2415], [97.2, 3896, 2004, 2501], [97.8, 5000, 2092, 2509], [91.9, 3904, 1884, 2440]],
  [10.65, [218.0, 0, 2183, 2210], [203.7, 0, 2081, 2391], [191.9, 0, 1933, 2375], [207.1, 0, 2020, 2404], [205.0, 817, 2087, 2313], [199.9, 2467, 1973, 2312], [206.3, 4735, 1974, 2385], [205.7, 3620, 2009, 2398], [194.6, 1796, 1929, 2346]],
  [15.98, [332.0, 0, 2147, 2065], [312.3, 0, 2056, 2278], [296.9, 0, 2035, 2273], [317.8, 0, 2139, 2234], [315.6, 0, 2037, 2144], [306.7, 459, 2040, 2205], [315.4, 2623, 2137, 2270], [315.8, 1509, 1999, 2279], [300.4, 21, 1952, 2242]],
  [21.31, [439.4, 0, 1983, 1955], [418.6, 0, 1946, 2171], [402.3, 243, 1960, 2170], [425.5, 0, 2030, 2081], [421.4, 0, 2014, 2008], [412.7, 73, 2009, 2100], [422.2, 1089, 2006, 2170], [420.6, 1382, 1998, 2177], [404.3, 0, 1954, 2144]],
  [30.90, [628.8, 0, 1923, 1771], [609.3, 1154, 1998, 1982], [594.3, 635, 2022, 1976], [620.0, 445, 2090, 1879], [613.4, 0, 1961, 1815], [607.5, 1495, 1982, 1896], [613.7, 981, 1966, 1940], [612.0, 450, 2055, 1985], [596.2, 0, 2062, 1951]],
  [40.49, [822.7, 0, 2002, 1659], [803.0, 87, 2129, 1825], [788.4, 486, 2053, 1848], [813.6, 269, 2077, 1723], [809.3, 0, 2048, 1726], [802.6, 1079, 2048, 1772], [809.3, 1097, 2042, 1821], [812.3, 721, 2112, 1888], [789.7, 0, 1999, 1840]],
  [50.08, [1012.2, 0, 2007, 1542], [996.6, 0, 2014, 1705], [982.9, 0, 2031, 1727], [1012.9, 533, 2027, 1636], [1002.1, 73, 2037, 1635], [1005.0, 1764, 2058, 1680], [1005.2, 1209, 2024, 1739], [1005.2, 219, 1966, 1776], [985.6, 0, 2013, 1707]],
  [60.73, [1220.9, 37, 1946, 1360], [1209.2, 159, 2001, 1553], [1197.1, 257, 1985, 1537], [1222.2, 91, 1956, 1443], [1214.2, 986, 1963, 1439], [1217.9, 793, 2010, 1480], [1215.7, 0, 1964, 1547], [1214.2, 0, 1958, 1577], [1198.5, 0, 1984, 1509]],
  [70.32, [1411.7, 0, 2153, 1155], [1401.8, 0, 2143, 1346], [1391.1, 0, 2195, 1365], [1419.6, 0, 2326, 1253], [1406.3, 986, 2182, 1269], [1414.4, 555, 2289, 1250], [1407.9, 0, 2151, 1335], [1405.8, 0, 2143, 1368], [1396.5, 466, 2236, 1278]],
  [80.98, [1665.6, 693, 2496, 746], [1653.5, 668, 2464, 895], [1647.5, 703, 2498, 900], [1681.2, 73, 2462, 766], [1659.3, 3786, 2471, 813], [1674.6, 3008, 2466, 752], [1661.0, 603, 2497, 881], [1657.5, 349, 2466, 920], [1654.3, 2555, 2487, 793]],
  [90.57, [1900.8, 693, 2474, 301], [1892.4, 1422, 2449, 372], [1887.9, 1134, 2467, 424], [1916.3, 73, 2433, 321], [1895.1, 5367, 2440, 362], [1912.2, 3008, 2445, 340], [1899.7, 243, 2510, 414], [1896.7, 1140, 2526, 501], [1892.2, 2555, 2489, 370]],
  [95.10, [2013.2, 693, 2436, 106], [2004.2, 1422, 2489, 163], [2000.9, 958, 2513, 203], [2027.5, 73, 2462, 160], [2006.3, 5367, 2471, 160], [2023.4, 3008, 2466, 172], [2015.2, 440, 2575, 250], [2011.7, 1140, 2533, 291], [2006.3, 2555, 2537, 161]]
];

export default function App() {
  const [selectedHorse, setSelectedHorse] = useState(3); // 默认选择冠军无声铃鹿
  const [selectedMetric, setSelectedMetric] = useState('speed'); // speed, hp, lane
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playSpeed, setPlaySpeed] = useState(1);
  const animationRef = useRef(null);
  const lastTimeRef = useRef(null);

  const [hoveredData, setHoveredData] = useState(null);
  const [hoverX, setHoverX] = useState(null);

  const maxTime = 95.10;

  // --- 高精度插值算法 (从离散的信号样本中计算完美的连续帧) ---
  const getInterpolatedTelemetry = (time) => {
    const clampedTime = Math.min(Math.max(0, time), maxTime);

    // 1. 寻找相邻的两个遥测数据点
    let prevSample = REAL_TELEM_SAMPLES[0];
    let nextSample = REAL_TELEM_SAMPLES[REAL_TELEM_SAMPLES.length - 1];

    for (let i = 0; i < REAL_TELEM_SAMPLES.length - 1; i++) {
      if (clampedTime >= REAL_TELEM_SAMPLES[i][0] && clampedTime <= REAL_TELEM_SAMPLES[i+1][0]) {
        prevSample = REAL_TELEM_SAMPLES[i];
        nextSample = REAL_TELEM_SAMPLES[i+1];
        break;
      }
    }

    const t0 = prevSample[0];
    const t1 = nextSample[0];
    const ratio = t1 === t0 ? 0 : (clampedTime - t0) / (t1 - t0);

    // 2. 对 9 匹马的物理属性进行线性插值
    const horsesFrame = prevSample.slice(1).map((prevHorseData, idx) => {
      const nextHorseData = nextSample[idx + 1];
      const dist = prevHorseData[0] + (nextHorseData[0] - prevHorseData[0]) * ratio;
      const lane = prevHorseData[1] + (nextHorseData[1] - prevHorseData[1]) * ratio;
      const speed = prevHorseData[2] + (nextHorseData[2] - prevHorseData[2]) * ratio;
      const hp = prevHorseData[3] + (nextHorseData[3] - prevHorseData[3]) * ratio;

      return {
        id: idx,
        distance: parseFloat(dist.toFixed(1)),
        lanePosition: Math.round(lane),
        speed: parseFloat((speed * 0.036).toFixed(1)), // 转换为 km/h
        hp: Math.round(hp)
      };
    });

    return {
      time: parseFloat(clampedTime.toFixed(2)),
      horses: horsesFrame
    };
  };

  // 获取当前秒数下的实时遥测数据
  const currentTelemetry = useMemo(() => {
    return getInterpolatedTelemetry(currentTime);
  }, [currentTime]);

  // 处理仿真自动播放
  useEffect(() => {
    if (isPlaying) {
      const step = (timestamp) => {
        if (!lastTimeRef.current) lastTimeRef.current = timestamp;
        const elapsed = timestamp - lastTimeRef.current;

        // 增量时间 (倍速补偿)
        const delta = (elapsed / 1000) * playSpeed;
        setCurrentTime((prev) => {
          const next = prev + delta;
          if (next >= maxTime) {
            setIsPlaying(false);
            return maxTime;
          }
          return next;
        });

        lastTimeRef.current = timestamp;
        animationRef.current = requestAnimationFrame(step);
      };
      animationRef.current = requestAnimationFrame(step);
    } else {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      lastTimeRef.current = null;
    }
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [isPlaying, playSpeed]);

  // SVG 折线图常数
  const chartWidth = 900;
  const chartHeight = 360;
  const padding = { top: 30, right: 40, bottom: 40, left: 60 };

  const getX = (time) => {
    return padding.left + (time / maxTime) * (chartWidth - padding.left - padding.right);
  };

  const getY = (val, type) => {
    const usableHeight = chartHeight - padding.top - padding.bottom;
    let min = 0, max = 100;
    if (type === 'speed') {
      min = 10; max = 95; // 速度区间：10km/h ~ 95km/h
    } else if (type === 'hp') {
      min = 0; max = 2700; // 体力区间
    } else if (type === 'lane') {
      min = -200; max = 5600; // 横向车道宽度坐标
    }
    const percent = (val - min) / (max - min);
    return chartHeight - padding.bottom - percent * usableHeight;
  };

  // 生成大折线图 SVG 路径
  const generateTelemetryPath = (horseId, type) => {
    let path = '';
    REAL_TELEM_SAMPLES.forEach((sample, i) => {
      const time = sample[0];
      const hData = sample[horseId + 1];
      let val = hData[2] * 0.036; // 默认 speed
      if (type === 'hp') val = hData[3];
      if (type === 'lane') val = hData[1];

      const x = getX(time);
      const y = getY(val, type);
      if (i === 0) path += `M ${x} ${y}`;
      else path += ` L ${x} ${y}`;
    });
    return path;
  };

  // 鼠标在折线图滑动计算
  const handleChartMouseMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const ratio = rect.width / chartWidth;
    const svgX = x / ratio;

    const usableWidth = chartWidth - padding.left - padding.right;
    let time = ((svgX - padding.left) / usableWidth) * maxTime;
    time = Math.min(Math.max(0, time), maxTime);

    // 搜索最接近的样本点
    let closestSample = REAL_TELEM_SAMPLES[0];
    let minDiff = Infinity;
    REAL_TELEM_SAMPLES.forEach((sample) => {
      const diff = Math.abs(sample[0] - time);
      if (diff < minDiff) {
        minDiff = diff;
        closestSample = sample;
      }
    });

    const parsedData = getInterpolatedTelemetry(closestSample[0]);
    setHoveredData(parsedData);
    setHoverX(getX(closestSample[0]));
  };

  const handleChartMouseLeave = () => {
    setHoveredData(null);
    setHoverX(null);
  };

  const handleChartClick = () => {
    if (hoveredData) {
      setCurrentTime(hoveredData.time);
    }
  };

  const getMetricMetadata = (type) => {
    switch (type) {
      case 'speed':
        return { name: '时速 (Speed)', unit: 'km/h', color: '#10b981', desc: '模拟计算转换后的千米时速' };
      case 'hp':
        return { name: '剩余体力值 (Stamina)', unit: 'HP', color: '#ef4444', desc: '比赛消耗耐力，过低将失速惩罚' };
      case 'lane':
        return { name: '横向车道坐标 (LanePosition)', unit: 'px', color: '#3b82f6', desc: '横向避让及超车时变化的横切坐标' };
      default:
        return { name: '', unit: '', color: '#ffffff', desc: '' };
    }
  };

  const currentSelectedHorseData = HORSES.find(h => h.id === selectedHorse);
  const currentSelectedTelemetry = currentTelemetry.horses.find(h => h.id === selectedHorse);

  // 过滤并寻找选定马匹的所有技能事件点
  const activeSkillsForSelectedHorse = useMemo(() => {
    return REAL_SKILL_EVENTS.filter(e => e.horseIndex === selectedHorse);
  }, [selectedHorse]);

  // 俄罗斯方块式拼图堆叠算法
  const skillTracks = useMemo(() => {
    // 1. 先按技能触发时间从早到晚进行排序
    const sortedSkills = [...activeSkillsForSelectedHorse].sort((a, b) => a.time - b.time);
    const tracks = []; // 存储轨道的二维数组

    sortedSkills.forEach(skill => {
      const duration = skill.duration || 3.0;
      const skillEnd = skill.time + duration;
      let placed = false;

      // 2. 依次寻找能塞下这个技能的“最底层轨道”
      for (let i = 0; i < tracks.length; i++) {
        const lastSkillInTrack = tracks[i][tracks[i].length - 1];
        const lastSkillEnd = lastSkillInTrack.time + (lastSkillInTrack.duration || 3.0);

        // 如果该技能的开始时间大于上一技能的结束时间，说明不重合，可以塞入
        if (skill.time >= lastSkillEnd) {
          tracks[i].push(skill);
          placed = true;
          break;
        }
      }

      // 3. 如果所有现有轨道都冲突，就像俄罗斯方块一样，往上“堆一层”新建一个轨道
      if (!placed) {
        tracks.push([skill]);
      }
    });

    return tracks;
  }, [activeSkillsForSelectedHorse]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-cyan-500 selection:text-slate-900">

      {/* 专业级赛道分析仪头部 */}
      <header className="border-b border-slate-900 bg-slate-900/40 backdrop-blur px-6 py-4">
        <div className="max-w-7xl mx-auto flex flex-col lg:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-3.5">
            <div className="bg-gradient-to-tr from-cyan-500 to-indigo-600 p-2.5 rounded-xl shadow-lg shadow-indigo-500/10">
              <svg className="w-5 h-5 text-slate-950" fill="currentColor" viewBox="0 0 24 24">
                <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-4 6h-4v2h4v2h-4v2h4v2H9V7h6v2z" />
              </svg>
            </div>
            <div>
              <h1 className="text-base font-black tracking-wider uppercase text-cyan-400">
                UMA-Telemetry Pro
              </h1>
              <p className="text-xs text-slate-500 font-medium">
                赛马娘模拟器数据流高保真物理遥测分析系统
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs bg-slate-900 px-3 py-1.5 rounded-xl border border-slate-800 text-slate-400">
              📁 关联遥测文件: <strong className="text-cyan-500">race_data_511201.json</strong>
            </span>
          </div>
        </div>
      </header>

      {/* 主面板内容 */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 lg:p-6 grid grid-cols-1 lg:grid-cols-4 gap-6">

        {/* 左侧：赛马战绩榜、仿真播放器 */}
        <div className="lg:col-span-1 space-y-6 flex flex-col justify-start">

          {/* 仿真核心控制器 */}
          <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-5 shadow-xl backdrop-blur-md">
            <h2 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3 pb-2 border-b border-slate-800/60 flex items-center justify-between">
              <span>⏱️ 数据时轴控制器</span>
              <span className="text-[10px] text-cyan-400 font-mono bg-cyan-950 border border-cyan-800/30 px-1.5 py-0.5 rounded-md">LIVE INTERPOLATOR</span>
            </h2>

            {/* 真实帧计时器 */}
            <div className="text-center bg-slate-950/80 border border-slate-850 py-3.5 rounded-xl mb-4">
              <div className="text-[9px] text-slate-500 uppercase tracking-widest font-bold">仿真流时间</div>
              <div className="text-3xl font-black text-cyan-400 font-mono tracking-tight mt-0.5">
                {currentTime.toFixed(2)} <span className="text-xs text-slate-500 font-normal">秒</span>
              </div>
              <div className="text-[10px] text-slate-400 mt-1 font-mono">
                总时长: {maxTime}s | {REAL_TELEM_SAMPLES.length} 帧路点
              </div>
            </div>

            {/* 播放控制按钮 */}
            <div className="flex gap-2">
              <button
                onClick={() => setIsPlaying(!isPlaying)}
                className={`flex-1 py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all ${
                  isPlaying
                    ? 'bg-rose-500 hover:bg-rose-600 text-white'
                    : 'bg-gradient-to-r from-cyan-500 to-blue-500 hover:brightness-110 text-slate-950 font-black'
                }`}
              >
                {isPlaying ? "暂停仿真" : "回放遥测流"}
              </button>

              <button
                onClick={() => { setIsPlaying(false); setCurrentTime(0); }}
                className="bg-slate-800 hover:bg-slate-700 text-slate-300 p-2.5 rounded-xl transition-all border border-slate-700/50"
                title="复位至起点"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 6H16" />
                </svg>
              </button>
            </div>

            {/* 播放速率 */}
            <div className="mt-4 flex items-center justify-between text-xs text-slate-400">
              <span>物理流速率:</span>
              <div className="flex bg-slate-950 p-0.5 rounded-lg border border-slate-850">
                {[1, 2, 4].map(speed => (
                  <button
                    key={speed}
                    onClick={() => setPlaySpeed(speed)}
                    className={`px-2.5 py-1 rounded font-mono font-bold text-[10px] ${playSpeed === speed ? 'bg-slate-800 text-cyan-400' : 'text-slate-500'}`}
                  >
                    {speed}x
                  </button>
                ))}
              </div>
            </div>

            {/* 进度拖拽条 */}
            <div className="mt-4 space-y-1">
              <input
                type="range"
                min="0"
                max={maxTime}
                step="0.05"
                value={currentTime}
                onChange={(e) => setCurrentTime(Number(e.target.value))}
                className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-500 focus:outline-none"
              />
            </div>
          </div>

          {/* 完赛名次榜 */}
          <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-5 shadow-xl backdrop-blur-md flex-1 overflow-hidden flex flex-col">
            <h2 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3 pb-2 border-b border-slate-800/60">
              🏆 最终完赛名次榜
            </h2>
            <div className="space-y-1.5 overflow-y-auto flex-1 pr-1">
              {HORSE_RESULTS.map((res) => {
                const horse = HORSES.find(h => h.id === res.id);
                const isSelected = selectedHorse === res.id;
                return (
                  <button
                    key={res.id}
                    onClick={() => setSelectedHorse(res.id)}
                    className={`w-full text-left p-2 rounded-xl transition-all border flex items-center justify-between ${
                      isSelected
                        ? 'bg-slate-800/80 border-cyan-500/40 text-cyan-400'
                        : 'bg-slate-950/20 border-slate-900 text-slate-300 hover:bg-slate-900/40'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className={`w-4 h-4 rounded-full flex items-center justify-center font-bold text-[9px] text-slate-950 font-mono`} style={{ backgroundColor: horse.color }}>
                        {res.order[0]}
                      </span>
                      <div className="truncate">
                        <span className="text-xs font-bold block truncate">{horse.name.split(' ')[0]}</span>
                        <span className="text-[8px] text-slate-500 font-mono">跑法: {res.style} | 冲刺点: {res.spurt}</span>
                      </div>
                    </div>
                    <div className="text-right font-mono text-[10px] text-slate-400">
                      <div>{res.time}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

        </div>

        {/* 右侧：折线图画布、双轨道车位图、生理/动力学诊断报告 */}
        <div className="lg:col-span-3 space-y-6 flex flex-col justify-start">

          {/* 折线画布卡片 */}
          <div className="bg-slate-900/80 border border-slate-800/80 rounded-3xl p-6 shadow-2xl relative">

            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 mb-4 pb-4 border-b border-slate-800/60">
              <div>
                <h3 className="text-sm font-black text-slate-300 tracking-wider">
                  📈 真实物理遥测折线图与技能发动区间
                </h3>
                <p className="text-[10px] text-slate-500 mt-0.5">
                  横轴为时间(s)，纵轴为数值。紫色半透明区域为当前选定马匹的<b>技能激活持续区间</b>。
                </p>
              </div>

              {/* 核心指标切换器 */}
              <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-850">
                {['speed', 'hp', 'lane'].map((metric) => {
                  const meta = getMetricMetadata(metric);
                  return (
                    <button
                      key={metric}
                      onClick={() => setSelectedMetric(metric)}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                        selectedMetric === metric
                          ? 'bg-slate-800 text-cyan-400 border-t border-slate-700/20 shadow-sm'
                          : 'text-slate-500 hover:text-slate-300'
                      }`}
                    >
                      {meta.name.split(' ')[0]}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* SVG折线图核心区域 */}
            <div className="relative select-none">
              <svg
                viewBox={`0 0 ${chartWidth} ${chartHeight}`}
                className="w-full h-auto overflow-visible"
                onMouseMove={handleChartMouseMove}
                onMouseLeave={handleChartMouseLeave}
                onClick={handleChartClick}
              >
                <defs>
                  {/* 技能高亮区间的渐变阴影 */}
                  <linearGradient id="skill-glow" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#a855f7" stopOpacity="0.25" />
                    <stop offset="100%" stopColor="#c084fc" stopOpacity="0.01" />
                  </linearGradient>
                </defs>

                {/* 1. 绘制当前选定马匹的技能发动区间 (背景高亮条) */}
                {activeSkillsForSelectedHorse.map((ev, idx) => {
                  const xStart = getX(ev.time);
                  const duration = ev.duration || 3.0;
                  const xEnd = getX(ev.time + duration);
                  const width = xEnd - xStart;
                  const skillName = SKILL_DICTIONARY[ev.skillId] || `技能 ${ev.skillId}`;

                  return (
                    <g key={`shading-${idx}`}>
                      <rect
                        x={xStart}
                        y={padding.top}
                        width={width}
                        height={chartHeight - padding.top - padding.bottom}
                        fill="url(#skill-glow)"
                      />
                      <line
                        x1={xStart}
                        y1={padding.top}
                        x2={xStart}
                        y2={chartHeight - padding.bottom}
                        stroke="#c084fc"
                        strokeWidth="1"
                        strokeDasharray="2 3"
                        opacity="0.6"
                      />
                      <line
                        x1={xEnd}
                        y1={padding.top}
                        x2={xEnd}
                        y2={chartHeight - padding.bottom}
                        stroke="#a855f7"
                        strokeWidth="1"
                        strokeDasharray="2 3"
                        opacity="0.3"
                      />
                      <text
                        x={xStart + 3}
                        y={padding.top + 12 + (idx % 3) * 12}
                        fill="#d8b4fe"
                        fontSize="8"
                        fontWeight="bold"
                        opacity="0.8"
                      >
                        ⚡ {skillName.split(' ')[0]}
                      </text>
                    </g>
                  );
                })}

                {/* 网格水平线 */}
                {[0, 25, 50, 75, 100].map((percent) => {
                  const usableHeight = chartHeight - padding.top - padding.bottom;
                  const y = chartHeight - padding.bottom - (percent / 100) * usableHeight;
                  return (
                    <g key={percent}>
                      <line
                        x1={padding.left}
                        y1={y}
                        x2={chartWidth - padding.right}
                        y2={y}
                        stroke="rgba(71, 85, 105, 0.12)"
                        strokeWidth={1}
                      />
                      <text
                        x={chartWidth - padding.right + 6}
                        y={y + 3}
                        fill="rgba(148, 163, 184, 0.3)"
                        fontSize="8"
                        fontFamily="monospace"
                      >
                        {percent}%
                      </text>
                    </g>
                  );
                })}

                {/* 网格竖直时间刻度线 */}
                {[0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 95.1].map((t) => {
                  const x = getX(t);
                  return (
                    <g key={t}>
                      <line
                        x1={x}
                        y1={padding.top}
                        x2={x}
                        y2={chartHeight - padding.bottom}
                        stroke="rgba(71, 85, 105, 0.08)"
                        strokeWidth={1}
                      />
                      <text x={x} y={chartHeight - padding.bottom + 14} textAnchor="middle" fill="rgba(148, 163, 184, 0.4)" fontSize="8" fontFamily="monospace">
                        {t}s
                      </text>
                    </g>
                  );
                })}

                {/* 绘制所有马匹的数据线 */}
                {HORSES.map((h) => {
                  const isSelected = h.id === selectedHorse;
                  return (
                    <path
                      key={h.id}
                      d={generateTelemetryPath(h.id, selectedMetric)}
                      fill="none"
                      stroke={h.color}
                      strokeWidth={isSelected ? 4.5 : 1.2}
                      strokeOpacity={isSelected ? 1.0 : 0.2}
                      className="transition-all duration-300 filter"
                      style={{
                        filter: isSelected ? `drop-shadow(0 0 6px ${h.color}50)` : 'none'
                      }}
                    />
                  );
                })}

                {/* 精准起始点 */}
                {activeSkillsForSelectedHorse.map((skillEvent, idx) => {
                  const horseDataAtTime = getInterpolatedTelemetry(skillEvent.time).horses.find(h => h.id === selectedHorse);
                  if (!horseDataAtTime) return null;

                  let val = horseDataAtTime.speed / 0.036;
                  if (selectedMetric === 'hp') val = horseDataAtTime.hp;
                  if (selectedMetric === 'lane') val = horseDataAtTime.lanePosition;

                  const x = getX(skillEvent.time);
                  const y = getY(val, selectedMetric);

                  return (
                    <g key={idx} className="animate-pulse">
                      <circle
                        cx={x}
                        cy={y}
                        r={8}
                        fill="transparent"
                        stroke="#c084fc"
                        strokeWidth={1.5}
                        strokeDasharray="2 2"
                      />
                      <circle
                        cx={x}
                        cy={y}
                        r={4.5}
                        fill="#c084fc"
                        className="cursor-pointer animate-ping"
                      />
                      <circle
                        cx={x}
                        cy={y}
                        r={3.5}
                        fill="#d8b4fe"
                      />
                    </g>
                  );
                })}

                {/* 坐标轴 Y轴 */}
                <line
                  x1={padding.left}
                  y1={padding.top}
                  x2={padding.left}
                  y2={chartHeight - padding.bottom}
                  stroke="rgba(148, 163, 184, 0.2)"
                  strokeWidth={1}
                />

                <g fontSize="8" fill="rgba(148, 163, 184, 0.6)" fontFamily="monospace">
                  {selectedMetric === 'speed' && [20, 40, 60, 80, 90].map(v => (
                    <text key={v} x={padding.left - 8} y={getY(v, 'speed') + 3} textAnchor="end">{v} km/h</text>
                  ))}
                  {selectedMetric === 'hp' && [0, 500, 1000, 1500, 2000, 2500].map(v => (
                    <text key={v} x={padding.left - 8} y={getY(v, 'hp') + 3} textAnchor="end">{v} HP</text>
                  ))}
                  {selectedMetric === 'lane' && [0, 1000, 2000, 3000, 4000, 5000].map(v => (
                    <text key={v} x={padding.left - 8} y={getY(v, 'lane') + 3} textAnchor="end">{v}</text>
                  ))}
                </g>

                {/* 进度游标线 */}
                <line
                  x1={getX(currentTime)}
                  y1={padding.top}
                  x2={getX(currentTime)}
                  y2={chartHeight - padding.bottom}
                  stroke="#22d3ee"
                  strokeWidth={1.5}
                  className="filter drop-shadow-[0_0_3px_rgba(34,211,238,0.8)]"
                />
                <g transform={`translate(${getX(currentTime)}, ${padding.top})`}>
                  <polygon points="0,0 -4,-8 4,-8" fill="#22d3ee" />
                  <circle cx="0" cy="-11" r="6" fill="#22d3ee" />
                  <text x="0" y="-9" textAnchor="middle" fill="#020617" fontSize="7" fontWeight="bold">🐴</text>
                </g>

                {/* 鼠标位置探针 */}
                {hoverX !== null && hoveredData && (
                  <g>
                    <line
                      x1={hoverX}
                      y1={padding.top}
                      x2={hoverX}
                      y2={chartHeight - padding.bottom}
                      stroke="rgba(148, 163, 184, 0.4)"
                      strokeWidth={1}
                      strokeDasharray="3 3"
                    />
                    <circle cx={hoverX} cy={chartHeight - padding.bottom} r="3" fill="#cbd5e1" />
                  </g>
                )}
              </svg>

              {/* Tooltip */}
              {hoverX !== null && hoveredData && (
                <div
                  className="absolute bg-slate-950/95 border border-slate-800 p-3.5 rounded-2xl shadow-2xl text-xs pointer-events-none z-30 min-w-[220px]"
                  style={{
                    left: `${Math.min(hoverX + 15, chartWidth - 240)}px`,
                    top: '50px'
                  }}
                >
                  <div className="font-bold text-cyan-400 mb-1.5 flex justify-between items-center border-b border-slate-900 pb-1">
                    <span>📍 对应时间: {hoveredData.time}s</span>
                    <span className="text-[9px] text-slate-500 font-normal">多马遥测对比</span>
                  </div>

                  <div className="space-y-1">
                    <div className="text-[10px] text-slate-400 font-bold mb-1">
                      马匹实时 {getMetricMetadata(selectedMetric).name.split(' ')[0]}
                    </div>
                    {HORSES.map((h) => {
                      const telemetryAtTime = hoveredData.horses.find(item => item.id === h.id);
                      let displayVal = telemetryAtTime.speed;
                      if (selectedMetric === 'hp') displayVal = telemetryAtTime.hp;
                      if (selectedMetric === 'lane') displayVal = telemetryAtTime.lanePosition;
                      const isTarget = h.id === selectedHorse;

                      return (
                        <div key={h.id} className={`flex justify-between items-center ${isTarget ? 'bg-slate-900 px-1 py-0.5 rounded text-cyan-400' : ''}`}>
                          <span className="text-slate-400 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: h.color }} />
                            {h.name.split(' ')[0]}
                          </span>
                          <span className="font-mono font-bold" style={{ color: isTarget ? '#22d3ee' : h.color }}>
                            {displayVal}
                            <span className="text-[8px] font-normal ml-0.5 text-slate-500">{getMetricMetadata(selectedMetric).unit}</span>
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* 技能方块堆叠轨 (Tetris Stacking Track) */}
            <div className="bg-slate-950/85 p-3 rounded-xl border border-slate-900/60 mt-3">
              <div className="flex justify-between items-center text-[11px] mb-2">
                <span className="font-bold text-slate-300 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded bg-purple-500 animate-pulse" />
                  ⚡ {currentSelectedHorseData.name.split(' ')[0]} - 技能堆叠时序图 (Tetris Mode)
                </span>
                <span className="text-[9px] text-slate-500 font-mono">
                  共计 {skillTracks.length} 层并发轨道
                </span>
              </div>

              <div className="relative overflow-y-auto space-y-1 pr-1.5 max-h-28 scrollbar-thin">
                {skillTracks.length === 0 ? (
                  <div className="text-center text-[10px] text-slate-600 py-6">
                    当前选定马匹在本场比赛中无主动触发技能
                  </div>
                ) : (
                  skillTracks.map((track, trackIdx) => (
                    <div key={trackIdx} className="relative h-[18px] bg-slate-900/30 rounded-md border border-slate-950 flex items-center">

                      <span className="absolute left-1.5 text-[7px] font-black text-slate-600 font-mono tracking-wider select-none z-10">
                        L{trackIdx + 1}
                      </span>

                      {track.map((ev, idx) => {
                        const skillName = SKILL_DICTIONARY[ev.skillId] || `技能 ${ev.skillId}`;
                        const duration = ev.duration || 3.0;

                        const startPct = (ev.time / maxTime) * 100;
                        const durationPct = (duration / maxTime) * 100;

                        const isActive = currentTime >= ev.time && currentTime <= ev.time + duration;
                        const isPassed = currentTime > ev.time + duration;

                        return (
                          <div
                            key={idx}
                            className={`absolute h-[14px] rounded border px-1.5 flex items-center justify-between transition-all duration-300 shadow-sm truncate overflow-hidden ${
                              isActive
                                ? 'bg-gradient-to-r from-purple-600 via-purple-500 to-cyan-500 border-cyan-400 text-white font-extrabold shadow-md shadow-purple-500/10'
                                : isPassed
                                ? 'bg-purple-950/5 border-purple-950/10 text-purple-400/15'
                                : 'bg-slate-800/60 border-slate-700/30 text-slate-400'
                            }`}
                            style={{
                              left: `${startPct}%`,
                              width: `${durationPct}%`,
                              minWidth: '40px'
                            }}
                            title={`${skillName} (持续: ${ev.time.toFixed(2)}s ~ ${(ev.time + duration).toFixed(2)}s)`}
                          >
                            <span className="text-[8px] truncate tracking-tight leading-none scale-95 origin-left">
                              ⚡ {skillName.split(' ')[0]}
                            </span>
                            {isActive && (
                              <span className="w-1 h-1 rounded-full bg-cyan-400 animate-ping shrink-0 ml-1" />
                            )}
                          </div>
                        );
                      })}

                    </div>
                  ))
                )}

                {/* 贯穿进度针 */}
                {skillTracks.length > 0 && (
                  <div
                    className="absolute top-0 bottom-0 w-0.5 bg-cyan-400/80 z-20 pointer-events-none filter drop-shadow-[0_0_2px_#22d3ee]"
                    style={{ left: `${(currentTime / maxTime) * 100}%` }}
                  />
                )}
              </div>
            </div>

          </div>

          {/* 车道轨迹图 */}
          <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-5 shadow-xl">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3 flex justify-between items-center">
              <span>🛣️ 真实跑道多马卡位/变换车道轨迹图 (九车道横向定位)</span>
              <span className="text-[10px] text-slate-500 font-mono">横向范围: 0 ~ 5367 (车道数值)</span>
            </h3>

            <div className="bg-slate-950 p-4 rounded-xl border border-slate-900 relative">
              <div className="relative h-28 bg-slate-900 border border-slate-800/80 rounded-lg overflow-hidden flex flex-col justify-between py-1">

                {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((lineIndex) => {
                  const topPercent = (lineIndex / 8) * 100;
                  return (
                    <div
                      key={lineIndex}
                      className="absolute left-0 right-0 h-0.5 border-t border-dashed border-slate-800/60 pointer-events-none"
                      style={{ top: `${topPercent}%` }}
                    />
                  );
                })}

                {currentTelemetry.horses.map((item) => {
                  const horse = HORSES.find(h => h.id === item.id);
                  const isSelected = item.id === selectedHorse;

                  const scaledYPercent = Math.min(Math.max((item.lanePosition / 5500) * 100, 3), 94);

                  const distances = currentTelemetry.horses.map(h => h.distance);
                  const maxD = Math.max(...distances, 1);
                  const minD = Math.min(...distances, 0);
                  const diff = maxD - minD;

                  const relativeXPercent = diff === 0 ? 50 : 10 + ((item.distance - minD) / diff) * 80;

                  return (
                    <div
                      key={item.id}
                      className={`absolute transition-all duration-150 ease-out z-20 flex items-center gap-1 ${
                        isSelected ? 'scale-125 z-30' : 'opacity-80'
                      }`}
                      style={{
                        top: `calc(${scaledYPercent}% - 10px)`,
                        left: `${relativeXPercent}%`,
                        transform: 'translateX(-50%)'
                      }}
                    >
                      <span
                        className={`text-[9px] font-black w-5 h-5 rounded-full flex items-center justify-center text-slate-950 font-mono shadow-md ${
                          isSelected ? 'ring-2 ring-cyan-400 ring-offset-2 ring-offset-slate-950' : ''
                        }`}
                        style={{ backgroundColor: horse.color }}
                        title={`${horse.name} (车道:${item.lanePosition}, 进度:${item.distance}m)`}
                      >
                        {item.id + 1}
                      </span>
                      {isSelected && (
                        <span className="text-[8px] bg-slate-950 text-cyan-400 px-1 py-0.2 rounded border border-cyan-800/40 font-mono truncate max-w-[80px]">
                          {horse.name.split(' ')[0]}
                        </span>
                      )}
                    </div>
                  );
                })}

              </div>
            </div>
          </div>

          {/* 生理指数与倒计时监控 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

            <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-5">
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                <span className="w-1.5 h-3 bg-cyan-400 rounded" />
                <span>📊 {currentSelectedHorseData.name.split(' ')[0]} 当前生理指数</span>
              </h3>

              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-2.5">
                  <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-850 text-center">
                    <span className="text-[10px] text-slate-500 block">实时速度</span>
                    <span className="text-base font-black text-emerald-400 font-mono mt-0.5 block">
                      {currentSelectedTelemetry.speed} <span className="text-[10px] font-normal text-slate-500">km/h</span>
                    </span>
                  </div>
                  <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-850 text-center">
                    <span className="text-[10px] text-slate-500 block">剩余耐力</span>
                    <span className="text-base font-black text-amber-500 font-mono mt-0.5 block">
                      {currentSelectedTelemetry.hp} <span className="text-[10px] font-normal text-slate-500">HP</span>
                    </span>
                  </div>
                  <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-850 text-center">
                    <span className="text-[10px] text-slate-500 block">横向坐标</span>
                    <span className="text-base font-black text-cyan-400 font-mono mt-0.5 block">
                      {currentSelectedTelemetry.lanePosition}
                    </span>
                  </div>
                </div>

                <div className="bg-slate-950 p-3 rounded-xl border border-slate-850">
                  <div className="flex justify-between items-center text-[10px] text-slate-400 mb-1.5">
                    <span>比赛累计距离 (Distance Progress)</span>
                    <span className="font-mono text-cyan-400 font-bold">{currentSelectedTelemetry.distance} / 2027.5 米</span>
                  </div>
                  <div className="h-1.5 w-full bg-slate-900 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-cyan-600 to-cyan-400 transition-all duration-200"
                      style={{ width: `${(currentSelectedTelemetry.distance / 2027.5) * 100}%` }}
                    />
                  </div>
                </div>

                <p className="text-[11px] text-slate-400 leading-relaxed bg-slate-950/30 p-2.5 rounded-lg border border-slate-850">
                  📋 <strong className="text-slate-300">赛时评估：</strong>
                  该赛马策略为 <strong>{currentSelectedHorseData.style === '逃 (Nige)' ? '逃跑(领跑领头马)' : '先行马'}</strong>。
                  {currentSelectedTelemetry.hp > 1500 ? "目前体力极度充足，正处于有节奏的黄金中控区。" :
                   currentSelectedTelemetry.hp > 600 ? "体力正在迅速流失，马匹已经进入中后段，各技能正在待机爆发状态。" :
                   "体力已基本见底！马匹进入末端拼命挣扎的极速衰退期。"}
                </p>
              </div>
            </div>

            <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-5 flex flex-col">
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                <span className="w-1.5 h-3 bg-purple-500 rounded" />
                <span>⚡ 技能发动倒计时与区间监控</span>
              </h3>

              <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 max-h-[170px] scrollbar-thin">
                {activeSkillsForSelectedHorse.length === 0 ? (
                  <div className="text-center text-[11px] text-slate-500 py-8">
                    该时间段内未检测到主动技能发动事件点
                  </div>
                ) : (
                  activeSkillsForSelectedHorse.map((ev, idx) => {
                    const skillName = SKILL_DICTIONARY[ev.skillId] || `自定义加成技能 (ID: ${ev.skillId})`;
                    const duration = ev.duration || 3.0;

                    const hasFired = currentTime >= ev.time;
                    const isActive = currentTime >= ev.time && currentTime <= ev.time + duration;
                    const isPassed = currentTime > ev.time + duration;
                    const remaining = Math.max(0, (ev.time + duration) - currentTime);

                    let badgeText = "未发动";
                    let badgeClass = "bg-slate-950 border-slate-900 text-slate-500";
                    if (isActive) {
                      badgeText = `持续中 (剩 ${remaining.toFixed(1)}s)`;
                      badgeClass = "bg-cyan-950/80 border-cyan-500/40 text-cyan-400 font-bold animate-pulse";
                    } else if (isPassed) {
                      badgeText = "已结束";
                      badgeClass = "bg-purple-950/20 border-purple-900/20 text-purple-400/40";
                    }

                    return (
                      <div
                        key={idx}
                        className={`p-2 rounded-xl border text-xs flex flex-col gap-1.5 transition-all ${
                          isActive
                            ? 'bg-purple-950/30 border-purple-500/40 text-purple-200'
                            : 'bg-slate-950/20 border-slate-900/60 text-slate-500'
                        }`}
                      >
                        <div className="flex justify-between items-start">
                          <div className="flex items-center gap-1.5">
                            <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-purple-400 animate-ping' : hasFired ? 'bg-slate-700' : 'bg-slate-800'}`} />
                            <div>
                              <span className="font-bold block text-slate-200">{skillName}</span>
                              <span className="text-[9px] text-slate-500 font-mono">触发时间: {ev.time.toFixed(2)}s | 持续: {duration.toFixed(1)}s</span>
                            </div>
                          </div>

                          <span className={`px-2 py-0.5 rounded text-[8px] border ${badgeClass}`}>
                            {badgeText}
                          </span>
                        </div>

                        {isActive && (
                          <div className="h-1 w-full bg-slate-950 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-purple-500 to-cyan-400 transition-all duration-100"
                              style={{ width: `${(remaining / duration) * 100}%` }}
                            />
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>

          </div>

        </div>

      </main>

      <footer className="border-t border-slate-900 bg-slate-950/50 py-3 text-center text-[10px] text-slate-600">
        UMA-Telemetry Analyzer v1.1.0 - 技能作用范围高保真分析引擎
      </footer>

    </div>
  );
}

const palettes = [
  ["#142D40", "#F3B526", "#F8F1E3", "#D86562"],
  ["#F1DBCF", "#8F3442", "#FDF9EE", "#254B65"],
  ["#1F4843", "#C7E0C0", "#F9ECC9", "#DC794F"],
  ["#283B7A", "#EAB0BD", "#F4D15A", "#FCF9EE"],
  ["#ECBC42", "#273A41", "#FFF7E7", "#C54F44"],
];

/** Original cover art; no text is baked into the image. */
export function programmeArtwork(index: number): Buffer {
  const [background, a, b, c] = palettes[index % palettes.length];
  const shapes = [
    `<path d="M-80 700 Q260 -180 600 400 T1320 0" fill="none" stroke="${a}" stroke-width="140"/><path d="M-120 740 Q230 -80 600 500 T1320 140" fill="none" stroke="${c}" stroke-width="55"/><path d="M180 80v280m65-230v210m65-170v150m65-115v100" stroke="${b}" stroke-width="16"/>`,
    `<path d="M80 550H340V170H610V400H910V70H1200" fill="none" stroke="${b}" stroke-width="56"/><path d="M80 550H340V170H610V400H910V70H1200" fill="none" stroke="${a}" stroke-width="8" stroke-dasharray="12 28"/>`,
    `<path d="M130 120 Q350 30 560 180V650Q350 480 130 570Z" fill="${b}"/><path d="M590 180 Q800 30 1070 120V570Q800 480 590 650Z" fill="${a}"/><path d="M590 180v470" stroke="${c}" stroke-width="15"/><g stroke="${background}" stroke-width="8"><path d="M200 200l280 70M200 260l280 70M200 320l200 50M680 250l290-65M680 320l290-65"/></g>`,
    `<g transform="rotate(-12 600 360)"><rect x="200" y="140" width="800" height="430" rx="12" fill="${b}"/><path d="M200 140L600 410L1000 140" fill="${a}"/><path d="M200 570L470 330M1000 570L730 330" stroke="${c}" stroke-width="7"/><rect x="465" y="100" width="270" height="210" fill="${b}"/><path d="M510 155h170m-170 45h125m-125 45h150" stroke="${background}" stroke-width="10"/></g>`,
    `<ellipse cx="600" cy="390" rx="390" ry="220" fill="${a}"/><ellipse cx="600" cy="390" rx="280" ry="155" fill="${b}"/><ellipse cx="600" cy="390" rx="190" ry="100" fill="${c}"/><path d="M470 290Q370 170 490 40M610 280Q510 140 640 15M750 295Q650 170 780 65" fill="none" stroke="${b}" stroke-width="18" stroke-linecap="round"/>`,
    `<g transform="rotate(-13 550 400)"><path d="M220 110H620L960 300V670H560L220 480Z" fill="${b}"/><path d="M220 110L560 300V670L220 480Z" fill="${c}"/><path d="M620 110V480L960 670V300Z" fill="${a}"/><path d="M220 110L560 300H960M560 300V670M620 110V480" fill="none" stroke="${background}" stroke-width="7"/><path d="M290 250l190 110m-190-45l190 110" stroke="${b}" stroke-width="13"/></g>`,
    `<path d="M500 0L120 700H1080L700 0Z" fill="${a}" opacity=".35"/><rect x="540" y="180" width="120" height="250" rx="60" fill="${b}"/><path d="M500 320v55a100 100 0 00200 0v-55m-100 155v160m-110 0h220" stroke="${c}" fill="none" stroke-width="22" stroke-linecap="round"/>`,
    `<g transform="rotate(-8 600 350)"><rect x="150" y="100" width="900" height="470" rx="12" fill="${b}"/><rect x="150" y="100" width="900" height="90" fill="${a}"/><path d="M230 285h380m-380 65h620m-620 65h450" stroke="${background}" stroke-width="18" stroke-linecap="round"/><circle cx="940" cy="430" r="60" fill="${c}"/></g>`,
    `<g fill="none" stroke-linecap="round"><path d="M0 290Q100 40 200 290T400 290T600 290T800 290T1000 290T1200 290" stroke="${a}" stroke-width="52"/><path d="M0 440Q150 160 300 440T600 440T900 440T1200 440" stroke="${b}" stroke-width="24"/><path d="M0 570Q200 250 400 570T800 570T1200 570" stroke="${c}" stroke-width="14"/></g>`,
    `<rect x="210" y="30" width="780" height="670" rx="180" fill="${a}"/><path d="M600 30V700M210 360H990" stroke="${background}" stroke-width="26"/><path d="M290 130l170 120m270-120l170 120M290 460l170 120m270-120l170 120" stroke="${b}" stroke-width="7" opacity=".7"/><path d="M100 730Q550 530 1100 730" stroke="${c}" stroke-width="90" fill="none"/>`,
    `<g transform="rotate(15 600 350)"><path d="M290 100H850L1040 350L850 600H290Z" fill="${a}"/><circle cx="880" cy="350" r="35" fill="${background}"/><path d="M880 350Q1180 20 1180 350" stroke="${b}" stroke-width="14" fill="none"/><path d="M370 240h350m-350 80h260m-260 80h320" stroke="${b}" stroke-width="19"/></g>`,
    `<g transform="rotate(-6 600 360)"><rect x="110" y="80" width="380" height="470" fill="${a}"/><rect x="560" y="160" width="460" height="440" fill="${b}"/><path d="M160 180h270m-270 65h170m-170 65h240M640 280h290m-290 65h220m-220 65h260" stroke="${background}" stroke-width="12"/><circle cx="820" cy="110" r="80" fill="${c}"/></g>`,
    `<path d="M130 150h470v270H350L200 560V420H130Z" fill="${a}"/><path d="M620 270h470v270H990L830 670V540H620Z" fill="${b}"/><path d="M210 240h300m-300 70h220M700 360h300m-300 70h200" stroke="${background}" stroke-width="18"/>`,
    `<g stroke="${background}" stroke-width="18"><rect x="130" y="80" width="420" height="530" fill="${a}"/><rect x="620" y="80" width="420" height="530" fill="${b}"/><path d="M340 80V610M130 345H550M830 80V610M620 345H1040"/></g><path d="M50 680H1130" stroke="${c}" stroke-width="32"/>`,
    `<g fill="none" stroke-width="70"><path d="M-30 200Q150 70 330 200T690 200T1050 200T1410 200" stroke="${a}"/><path d="M-30 360Q150 230 330 360T690 360T1050 360T1410 360" stroke="${b}"/><path d="M-30 520Q150 390 330 520T690 520T1050 520T1410 520" stroke="${c}"/></g>`,
    `<path d="M90 140Q330 10 580 180V650Q330 450 90 550Z" fill="${b}"/><path d="M620 180Q850 10 1110 140V550Q850 450 620 650Z" fill="${a}"/><path d="M180 240Q350 160 500 270M180 330Q350 250 500 360M710 260Q880 160 1030 220M710 350Q880 250 1030 310" stroke="${background}" stroke-width="12" fill="none"/>`,
    `<circle cx="330" cy="270" r="110" fill="${a}"/><path d="M780 80a100 100 0 01100 100c0 70-100 95-100 160" fill="none" stroke="${b}" stroke-width="90" stroke-linecap="round"/><circle cx="780" cy="500" r="48" fill="${b}"/><path d="M260 430L210 600" stroke="${c}" stroke-width="70" stroke-linecap="round"/>`,
    `<path d="M80 160H1120V500H80Z" fill="${a}"/><g fill="${background}"><rect x="160" y="230" width="200" height="160" rx="15"/><rect x="420" y="230" width="200" height="160" rx="15"/><rect x="680" y="230" width="200" height="160" rx="15"/></g><path d="M0 600H1200M0 690H1200" stroke="${b}" stroke-width="28"/><path d="M150 570l-80 190m290-190l-80 190m290-190l-80 190m290-190l-80 190m290-190l-80 190" stroke="${c}" stroke-width="22"/>`,
    `<path d="M40 650H260V500H480V350H700V200H920V50H1160" stroke="${a}" stroke-width="70" fill="none"/><path d="M350 100h140v230H350zM790 380h140v230H790z" fill="${b}"/><circle cx="450" cy="210" r="9" fill="${c}"/><circle cx="890" cy="490" r="9" fill="${c}"/>`,
    `<path d="M150 680V430a450 450 0 01900 0v250" fill="${a}"/><path d="M330 680V430a270 270 0 01540 0v250" fill="${b}"/><path d="M510 680V430a90 90 0 01180 0v250" fill="${c}"/><path d="M80 700H1120" stroke="${background}" stroke-width="40"/>`,
  ];
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800" viewBox="0 0 1200 800"><rect width="1200" height="800" fill="${background}"/>${shapes[index]}</svg>`,
  );
}

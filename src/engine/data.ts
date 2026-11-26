// Board and card data for "Fabrykant". All numbers are starting values to tune in playtests.

export type Color = "przemysl" | "wladza" | "kultura" | "nedza";
export type Era = 1 | 2 | 3;

export type Pay =
  | { kind: "none" }
  | { kind: "card"; n: number } // any colour
  | { kind: "culture"; n: number } // Kultura cards only
  | { kind: "money"; n: number };

export type Effect = {
  money?: number;
  pp?: number;
  poverty?: number; // negative = discard Nędza
  tracks?: number;
};

export type Permanent = "landDiscount" | "loanRepay12" | "ppPerIndustry" | "noStrike";

export type CardDef = {
  id: string;
  name: string;
  era: Era;
  color: Color;
  cost: number;
  pp: number;
  copies: number;
  run?: { pay: Pay; effect: Effect; flips: boolean };
  permanent?: Permanent;
  event?: "strike8"; // played from hand without a matching discard, then removed
};

const c = (
  id: string, name: string, era: Era, color: Color, cost: number, pp: number, copies: number,
  run?: CardDef["run"], extra: Partial<CardDef> = {},
): CardDef => ({ id, name, era, color, cost, pp, copies, run, ...extra });

const card1 = { kind: "card", n: 1 } as const;
const card2 = { kind: "card", n: 2 } as const;
const cult1 = { kind: "culture", n: 1 } as const;
const money = (n: number) => ({ kind: "money", n }) as const;

export const CARDS: CardDef[] = [
  // Epoka I. Osada tkaczy (1820–1860)
  c("warsztat", "Warsztat tkacki", 1, "przemysl", 1, 0, 4, { pay: card1, effect: { money: 3 }, flips: true }),
  c("geyer", "Biała Fabryka Geyera", 1, "przemysl", 4, 2, 1, { pay: card1, effect: { money: 5 }, flips: false }),
  c("kolonia", "Kolonia tkaczy w Łódce", 1, "przemysl", 2, 1, 2, { pay: money(2), effect: { poverty: -2 }, flips: false }),
  c("farbiarnia", "Farbiarnia nad Jasieniem", 1, "przemysl", 3, 1, 2, { pay: card1, effect: { money: 4 }, flips: true }),
  c("tkalnia_reczna", "Tkalnia ręczna", 1, "przemysl", 2, 0, 3, { pay: card1, effect: { money: 2 }, flips: false }),
  c("rembielinski", "Plan Rembielińskiego", 1, "wladza", 2, 1, 1, undefined, { permanent: "landDiscount" }),
  c("magistrat", "Magistrat", 1, "wladza", 3, 1, 2, { pay: card1, effect: { pp: 2 }, flips: true }),
  c("urzad", "Urząd fabryczny", 1, "wladza", 2, 0, 2, { pay: card1, effect: { money: 2, pp: 1 }, flips: false }),
  c("stary_rynek", "Rynek Starego Miasta", 1, "wladza", 1, 1, 1, { pay: card1, effect: { money: 2 }, flips: false }),
  c("szkola", "Szkoła elementarna", 1, "kultura", 2, 1, 2, { pay: cult1, effect: { poverty: -3 }, flips: true }),
  c("stary_cmentarz", "Stary Cmentarz", 1, "kultura", 3, 2, 1, { pay: card1, effect: { poverty: -2 }, flips: false }),
  c("ochronka", "Ochronka dla dzieci", 1, "kultura", 2, 1, 2, { pay: money(1), effect: { poverty: -1 }, flips: false }),
  c("lazaret", "Lazaret miejski", 1, "kultura", 3, 1, 1, { pay: card1, effect: { poverty: -2 }, flips: true }),
  c("bezrobotni", "Bezrobotni tkacze", 1, "nedza", 0, 0, 4),

  // Epoka II. Ziemia obiecana (1860–1890)
  c("scheibler", "Przędzalnia Scheiblera", 2, "przemysl", 7, 3, 1, { pay: card1, effect: { money: 8 }, flips: false }),
  c("manufaktura", "Manufaktura Poznańskiego", 2, "przemysl", 8, 4, 1, { pay: card2, effect: { money: 6, pp: 2 }, flips: false }),
  c("grohman", "Zakłady Grohmana", 2, "przemysl", 6, 2, 1, { pay: card1, effect: { money: 6 }, flips: false }),
  c("heinzel_fabryka", "Fabryka Heinzla", 2, "przemysl", 6, 2, 1, { pay: card1, effect: { money: 6 }, flips: false }),
  c("tkalnia_mech", "Tkalnia mechaniczna", 2, "przemysl", 4, 1, 4, { pay: card1, effect: { money: 5 }, flips: true }),
  c("wykonczalnia", "Wykończalnia", 2, "przemysl", 3, 0, 3, { pay: card1, effect: { money: 4 }, flips: false }),
  c("przedzalnia_parowa", "Przędzalnia parowa", 2, "przemysl", 5, 1, 3, { pay: card1, effect: { money: 4, pp: 1 }, flips: true }),
  c("bielnik", "Bielnik", 2, "przemysl", 2, 0, 2, { pay: money(1), effect: { money: 3 }, flips: true }),
  c("bank_handlowy", "Bank Handlowy w Łodzi", 2, "wladza", 5, 2, 1, undefined, { permanent: "loanRepay12" }),
  c("dworzec_fabryczny", "Dworzec Fabryczny", 2, "wladza", 4, 2, 2, { pay: card1, effect: { tracks: 2 }, flips: false }),
  c("ratusz", "Ratusz", 2, "wladza", 5, 2, 1, { pay: card1, effect: { pp: 3 }, flips: false }),
  c("straz", "Straż Ogniowa Ochotnicza", 2, "wladza", 3, 1, 2, { pay: card1, effect: { poverty: -2 }, flips: false }),
  c("gielda_bawelny", "Giełda bawełny", 2, "wladza", 4, 1, 2, { pay: card1, effect: { money: 4 }, flips: false }),
  c("komitet", "Komitet Giełdowy", 2, "wladza", 3, 1, 2, { pay: cult1, effect: { pp: 3 }, flips: true }),
  c("victoria", "Teatr Victoria", 2, "kultura", 5, 3, 1, { pay: money(3), effect: { pp: 3 }, flips: false }),
  c("lodzer_zeitung", "Lodzer Zeitung", 2, "kultura", 3, 1, 2, { pay: card1, effect: { pp: 2 }, flips: true }),
  c("cerkiew", "Cerkiew św. Aleksandra Newskiego", 2, "kultura", 6, 3, 1, { pay: card1, effect: { poverty: -3 }, flips: false }),
  c("zrodliska", "Park Źródliska", 2, "kultura", 3, 2, 2, { pay: card1, effect: { poverty: -2 }, flips: false }),
  c("szkola_rzemiosl", "Szkoła rzemiosł", 2, "kultura", 3, 1, 2, { pay: cult1, effect: { poverty: -3 }, flips: true }),
  c("czytelnia", "Czytelnia ludowa", 2, "kultura", 2, 1, 2, { pay: card1, effect: { pp: 1 }, flips: false }),
  c("czynszowki", "Czynszówki na Bałutach", 2, "nedza", 0, 0, 4),
  c("cholera", "Epidemia cholery", 2, "nedza", 0, 0, 4),

  // Epoka III. Wielkie fortuny (1890–1914)
  c("ec1", "Elektrownia EC1", 3, "przemysl", 9, 3, 1, { pay: card1, effect: { money: 6 }, flips: false }, { permanent: "noStrike" }),
  c("kindermann_fabryka", "Fabryka Kindermanna", 3, "przemysl", 7, 3, 1, { pay: card1, effect: { money: 7 }, flips: false }),
  c("biedermann", "Fabryka Biedermanna", 3, "przemysl", 7, 3, 1, { pay: card1, effect: { money: 7 }, flips: false }),
  c("przedzalnia_el", "Przędzalnia elektryczna", 3, "przemysl", 6, 2, 4, { pay: card1, effect: { money: 6 }, flips: true }),
  c("farbiarnia_chem", "Farbiarnia chemiczna", 3, "przemysl", 5, 1, 3, { pay: card1, effect: { money: 5 }, flips: false }),
  c("tramwaj", "Pierwszy tramwaj 1898", 3, "wladza", 6, 3, 2, { pay: card1, effect: { tracks: 2 }, flips: false }),
  c("dworzec_kaliski", "Dworzec Kaliski", 3, "wladza", 6, 3, 1, { pay: card1, effect: { tracks: 2 }, flips: false }),
  c("kolejka", "Kolej dojazdowa", 3, "wladza", 5, 2, 2, { pay: card1, effect: { tracks: 2 }, flips: true }),
  c("grand_hotel", "Grand Hotel", 3, "wladza", 8, 3, 1, { pay: card1, effect: { money: 4, pp: 2 }, flips: false }),
  c("savoy", "Hotel Savoy", 3, "wladza", 6, 2, 2, { pay: card1, effect: { pp: 3 }, flips: true }),
  c("palac_poznanskiego", "Pałac Poznańskiego", 3, "kultura", 10, 5, 1, undefined, { permanent: "ppPerIndustry" }),
  c("willa_kindermanna", "Willa Kindermanna", 3, "kultura", 8, 4, 1, { pay: money(3), effect: { pp: 3 }, flips: false }),
  c("palac_herbsta", "Pałac Herbsta", 3, "kultura", 8, 4, 1, { pay: card1, effect: { pp: 3 }, flips: false }),
  c("szkola_kupcow", "Szkoła Zgromadzenia Kupców", 3, "kultura", 6, 3, 1, { pay: cult1, effect: { poverty: -4 }, flips: false }),
  c("synagoga", "Synagoga Reicherów", 3, "kultura", 6, 3, 1, { pay: card1, effect: { poverty: -3 }, flips: false }),
  c("mateusz", "Kościół św. Mateusza", 3, "kultura", 7, 3, 1, { pay: card1, effect: { poverty: -3 }, flips: false }),
  c("rubinstein", "Koncert Rubinsteina", 3, "kultura", 4, 2, 2, { pay: card1, effect: { pp: 2 }, flips: true }),
  c("rewolucja", "Rewolucja 1905", 3, "nedza", 0, 0, 1, undefined, { event: "strike8" }),
  c("bunt", "Bunt łódzki 1892", 3, "nedza", 0, 0, 1, undefined, { event: "strike8" }),
  c("nocna_zmiana", "Nocna zmiana dzieci", 3, "nedza", 0, 0, 2),
  c("bezrobocie", "Bezrobocie", 3, "nedza", 0, 0, 2),
];

export const CARD_BY_ID: Record<string, CardDef> = Object.fromEntries(CARDS.map((d) => [d.id, d]));

export type District = {
  id: string;
  name: string;
  price: number;
  cards: number;
  pp: number;
  town?: boolean; // buyable only when a neighbouring district has a track
  start?: boolean; // allowed for a player's first purchase
  x: number;
  y: number;
};

export const DISTRICTS: District[] = [
  { id: "stare_miasto", name: "Stare Miasto", price: 2, cards: 1, pp: 1, start: true, x: 48, y: 34 },
  { id: "nowe_miasto", name: "Nowe Miasto", price: 3, cards: 1, pp: 2, start: true, x: 50, y: 44 },
  { id: "lodka", name: "Łódka", price: 2, cards: 1, pp: 1, start: true, x: 60, y: 50 },
  { id: "srodmiescie", name: "Śródmieście", price: 8, cards: 3, pp: 5, x: 50, y: 56 },
  { id: "ksiezy_mlyn", name: "Księży Młyn", price: 6, cards: 2, pp: 4, x: 62, y: 63 },
  { id: "ogrodowa", name: "Ogrodowa", price: 6, cards: 2, pp: 4, x: 38, y: 40 },
  { id: "widzew", name: "Widzew", price: 5, cards: 2, pp: 3, x: 74, y: 48 },
  { id: "baluty", name: "Bałuty", price: 2, cards: 2, pp: 1, x: 44, y: 22 },
  { id: "polesie", name: "Polesie", price: 4, cards: 2, pp: 2, x: 32, y: 54 },
  { id: "gorna", name: "Górna", price: 4, cards: 2, pp: 2, x: 50, y: 72 },
  { id: "chojny", name: "Chojny", price: 3, cards: 2, pp: 1, x: 54, y: 86 },
  { id: "rokicie", name: "Rokicie", price: 3, cards: 2, pp: 1, x: 36, y: 74 },
  { id: "dabrowa", name: "Dąbrowa", price: 3, cards: 2, pp: 1, x: 66, y: 79 },
  { id: "zarzew", name: "Zarzew", price: 4, cards: 2, pp: 2, x: 74, y: 63 },
  { id: "stoki", name: "Stoki", price: 2, cards: 1, pp: 1, x: 72, y: 32 },
  { id: "radogoszcz", name: "Radogoszcz", price: 2, cards: 1, pp: 1, x: 38, y: 10 },
  { id: "marysin", name: "Marysin", price: 2, cards: 1, pp: 1, x: 56, y: 20 },
  { id: "julianow", name: "Julianów", price: 5, cards: 1, pp: 4, x: 28, y: 24 },
  { id: "lagiewniki", name: "Łagiewniki", price: 3, cards: 1, pp: 3, x: 60, y: 7 },
  { id: "nowosolna", name: "Nowosolna", price: 3, cards: 1, pp: 2, x: 86, y: 34 },
  { id: "zgierz", name: "Zgierz", price: 7, cards: 4, pp: 3, town: true, x: 26, y: 5 },
  { id: "aleksandrow", name: "Aleksandrów Łódzki", price: 6, cards: 3, pp: 3, town: true, x: 12, y: 40 },
  { id: "pabianice", name: "Pabianice", price: 7, cards: 4, pp: 3, town: true, x: 24, y: 90 },
  { id: "strykow", name: "Stryków", price: 5, cards: 3, pp: 2, town: true, x: 88, y: 10 },
];

const EDGES: [string, string][] = [
  ["stare_miasto", "nowe_miasto"], ["stare_miasto", "baluty"], ["stare_miasto", "ogrodowa"], ["stare_miasto", "marysin"],
  ["nowe_miasto", "srodmiescie"], ["nowe_miasto", "ogrodowa"], ["nowe_miasto", "lodka"],
  ["lodka", "srodmiescie"], ["lodka", "ksiezy_mlyn"], ["lodka", "widzew"],
  ["srodmiescie", "polesie"], ["srodmiescie", "gorna"], ["srodmiescie", "ksiezy_mlyn"],
  ["ogrodowa", "polesie"], ["ogrodowa", "baluty"], ["ogrodowa", "julianow"],
  ["baluty", "radogoszcz"], ["baluty", "marysin"], ["baluty", "julianow"],
  ["radogoszcz", "julianow"], ["radogoszcz", "lagiewniki"], ["marysin", "lagiewniki"], ["marysin", "stoki"],
  ["polesie", "rokicie"], ["gorna", "rokicie"], ["gorna", "chojny"], ["gorna", "ksiezy_mlyn"], ["gorna", "dabrowa"],
  ["ksiezy_mlyn", "widzew"], ["ksiezy_mlyn", "zarzew"], ["ksiezy_mlyn", "dabrowa"],
  ["widzew", "zarzew"], ["widzew", "stoki"], ["widzew", "nowosolna"], ["zarzew", "dabrowa"],
  ["dabrowa", "chojny"], ["chojny", "rokicie"], ["stoki", "nowosolna"],
  // towns
  ["zgierz", "radogoszcz"], ["zgierz", "julianow"],
  ["aleksandrow", "julianow"], ["aleksandrow", "polesie"],
  ["pabianice", "rokicie"], ["pabianice", "chojny"],
  ["strykow", "nowosolna"], ["strykow", "lagiewniki"],
];

export const ADJ: Record<string, string[]> = Object.fromEntries(DISTRICTS.map((d) => [d.id, [] as string[]]));
for (const [a, b] of EDGES) {
  ADJ[a].push(b);
  ADJ[b].push(a);
}

export const DISTRICT_BY_ID: Record<string, District> = Object.fromEntries(DISTRICTS.map((d) => [d.id, d]));
export const TRACK_START = "srodmiescie";

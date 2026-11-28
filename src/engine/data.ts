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
  about?: string; // one-line historical note shown as a tooltip
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
  c("magistrat", "Magistrat", 1, "wladza", 3, 1, 2, { pay: card1, effect: { pp: 1 }, flips: true }),
  c("urzad", "Urząd fabryczny", 1, "wladza", 2, 0, 2, { pay: card1, effect: { money: 2, pp: 1 }, flips: false }),
  c("stary_rynek", "Rynek Starego Miasta", 1, "wladza", 1, 1, 1, { pay: card1, effect: { money: 2 }, flips: false }),
  c("szkola", "Szkoła elementarna", 1, "kultura", 2, 1, 2, { pay: cult1, effect: { poverty: -3 }, flips: true }),
  c("stary_cmentarz", "Stary Cmentarz", 1, "kultura", 3, 2, 1, { pay: card1, effect: { poverty: -2 }, flips: false }),
  c("ochronka", "Ochronka dla dzieci", 1, "kultura", 2, 1, 2, { pay: money(1), effect: { poverty: -1 }, flips: false }),
  c("lazaret", "Lazaret miejski", 1, "kultura", 3, 1, 1, { pay: card1, effect: { poverty: -2 }, flips: true }),
  c("bezrobotni", "Bezrobotni tkacze", 1, "nedza", 0, 0, 4),
  c("wendisch", "Przędzalnia Wendischa", 1, "przemysl", 3, 1, 1, { pay: card1, effect: { money: 4 }, flips: false }),
  c("mlyn", "Młyn wodny na Jasieniu", 1, "przemysl", 2, 0, 2, { pay: money(1), effect: { money: 3 }, flips: true }),
  c("wodny_rynek", "Wodny Rynek", 1, "wladza", 2, 1, 1, { pay: card1, effect: { money: 2, pp: 1 }, flips: true }),
  c("kontrakt", "Kontrakt osadniczy", 1, "wladza", 2, 0, 1, { pay: card1, effect: { money: 3 }, flips: true }),
  c("sw_trojcy", "Kościół św. Trójcy", 1, "kultura", 4, 2, 1, { pay: card1, effect: { poverty: -2 }, flips: false }),
  c("pozar", "Pożar drewnianej osady", 1, "nedza", 0, 0, 2),

  // Epoka II. Ziemia obiecana (1860–1890)
  c("scheibler", "Przędzalnia Scheiblera", 2, "przemysl", 7, 3, 1, { pay: card1, effect: { money: 8 }, flips: false }),
  c("manufaktura", "Manufaktura Poznańskiego", 2, "przemysl", 8, 4, 1, { pay: card2, effect: { money: 6, pp: 1 }, flips: false }),
  c("grohman", "Zakłady Grohmana", 2, "przemysl", 6, 2, 1, { pay: card1, effect: { money: 6 }, flips: false }),
  c("heinzel_fabryka", "Fabryka Heinzla", 2, "przemysl", 6, 2, 1, { pay: card1, effect: { money: 6 }, flips: false }),
  c("tkalnia_mech", "Tkalnia mechaniczna", 2, "przemysl", 4, 1, 4, { pay: card1, effect: { money: 5 }, flips: true }),
  c("wykonczalnia", "Wykończalnia", 2, "przemysl", 3, 0, 2, { pay: card1, effect: { money: 4 }, flips: false }),
  c("przedzalnia_parowa", "Przędzalnia parowa", 2, "przemysl", 5, 1, 3, { pay: card1, effect: { money: 4, pp: 1 }, flips: true }),
  c("bielnik", "Bielnik", 2, "przemysl", 2, 0, 1, { pay: money(1), effect: { money: 3 }, flips: true }),
  c("biedermann", "Farbiarnia Biedermanna", 2, "przemysl", 6, 2, 1, { pay: card1, effect: { money: 6 }, flips: false }),
  c("bank_handlowy", "Bank Handlowy w Łodzi", 2, "wladza", 5, 2, 1, undefined, { permanent: "loanRepay12" }),
  c("dworzec_fabryczny", "Dworzec Fabryczny", 2, "wladza", 4, 2, 2, { pay: card1, effect: { tracks: 2 }, flips: false }),
  c("tkm", "Towarzystwo Kredytowe Miejskie", 2, "wladza", 5, 2, 1, { pay: card1, effect: { pp: 2 }, flips: false }),
  c("straz", "Straż Ogniowa Ochotnicza", 2, "wladza", 3, 1, 2, { pay: card1, effect: { poverty: -2 }, flips: false }),
  c("gielda_bawelny", "Giełda bawełny", 2, "wladza", 4, 1, 2, { pay: card1, effect: { money: 4 }, flips: false }),
  c("komitet", "Komitet Giełdowy", 2, "wladza", 3, 1, 2, { pay: cult1, effect: { pp: 2 }, flips: true }),
  c("grand_hotel", "Grand Hotel", 2, "wladza", 7, 3, 1, { pay: card1, effect: { money: 4, pp: 1 }, flips: false }),
  c("victoria", "Teatr Victoria", 2, "kultura", 5, 3, 1, { pay: money(3), effect: { pp: 2 }, flips: false }),
  c("lodzer_zeitung", "Lodzer Zeitung", 2, "kultura", 3, 1, 2, { pay: card1, effect: { pp: 1 }, flips: true }),
  c("cerkiew", "Cerkiew św. Aleksandra Newskiego", 2, "kultura", 6, 3, 1, { pay: card1, effect: { poverty: -3 }, flips: false }),
  c("zrodliska", "Park Źródliska", 2, "kultura", 3, 2, 2, { pay: card1, effect: { poverty: -2 }, flips: false }),
  c("szkola_rzemiosl", "Szkoła rzemiosł", 2, "kultura", 3, 1, 2, { pay: cult1, effect: { poverty: -3 }, flips: true }),
  c("czytelnia", "Czytelnia ludowa", 2, "kultura", 2, 1, 2, { pay: card1, effect: { pp: 1 }, flips: false }),
  c("palac_herbsta", "Pałac Herbsta", 2, "kultura", 8, 4, 1, { pay: card1, effect: { pp: 2 }, flips: false }),
  c("czynszowki", "Czynszówki na Bałutach", 2, "nedza", 0, 0, 4),
  c("cholera", "Epidemia cholery", 2, "nedza", 0, 0, 4),
  c("kunitzer", "Widzewska Manufaktura", 2, "przemysl", 7, 3, 1, { pay: card1, effect: { money: 7 }, flips: false }),
  c("familoki", "Familoki na Księżym Młynie", 2, "przemysl", 3, 1, 2, { pay: money(2), effect: { poverty: -2 }, flips: false }),
  c("palac_heinzla", "Pałac Heinzla", 2, "wladza", 7, 3, 1, { pay: card1, effect: { pp: 2 }, flips: false }),
  c("pasaz_meyera", "Pasaż Meyera", 2, "wladza", 4, 2, 1, { pay: card1, effect: { money: 3, pp: 1 }, flips: true }),
  c("sw_krzyza", "Kościół Podwyższenia św. Krzyża", 2, "kultura", 4, 2, 1, { pay: card1, effect: { poverty: -2 }, flips: false }),
  c("sw_jana", "Kościół św. Jana", 2, "kultura", 5, 2, 1, { pay: card1, effect: { poverty: -3 }, flips: true }),
  c("kaplica_scheiblera", "Kaplica Scheiblera", 2, "kultura", 5, 3, 1, { pay: money(2), effect: { pp: 1 }, flips: false }),
  c("palac_scheiblera", "Pałac Scheiblera", 2, "kultura", 7, 3, 1, { pay: card1, effect: { pp: 2 }, flips: false }),
  c("kryzys_bawelniany", "Głód bawełny", 2, "nedza", 0, 0, 2),

  // Epoka III. Wielkie fortuny (1890–1914)
  c("ec1", "Elektrownia EC1", 3, "przemysl", 9, 3, 1, { pay: card1, effect: { money: 6 }, flips: false }, { permanent: "noStrike" }),
  c("kindermann_fabryka", "Fabryka Kindermanna", 3, "przemysl", 7, 3, 1, { pay: card1, effect: { money: 7 }, flips: false }),
  c("przedzalnia_el", "Przędzalnia elektryczna", 3, "przemysl", 6, 2, 4, { pay: card1, effect: { money: 6 }, flips: true }),
  c("farbiarnia_chem", "Farbiarnia chemiczna", 3, "przemysl", 5, 1, 4, { pay: card1, effect: { money: 5 }, flips: false }),
  c("tramwaj", "Pierwszy tramwaj 1898", 3, "wladza", 6, 3, 2, { pay: card1, effect: { tracks: 2 }, flips: false }),
  c("dworzec_kaliski", "Dworzec Kaliski", 3, "wladza", 6, 3, 1, { pay: card1, effect: { tracks: 2 }, flips: false }),
  c("kolejka", "Kolej dojazdowa", 3, "wladza", 5, 2, 3, { pay: card1, effect: { tracks: 2 }, flips: true }),
  c("savoy", "Hotel Savoy", 3, "wladza", 6, 2, 2, { pay: card1, effect: { pp: 2 }, flips: true }),
  c("palac_poznanskiego", "Pałac Poznańskiego", 3, "kultura", 10, 5, 1, undefined, { permanent: "ppPerIndustry" }),
  c("willa_kindermanna", "Willa Kindermanna", 3, "kultura", 8, 4, 1, { pay: money(3), effect: { pp: 2 }, flips: false }),
  c("palac_biedermanna", "Pałac Alfreda Biedermanna", 3, "kultura", 8, 4, 1, { pay: card1, effect: { pp: 2 }, flips: false }),
  c("szkola_kupcow", "Szkoła Zgromadzenia Kupców", 3, "kultura", 6, 3, 1, { pay: cult1, effect: { poverty: -4 }, flips: false }),
  c("synagoga", "Synagoga Reicherów", 3, "kultura", 6, 3, 1, { pay: card1, effect: { poverty: -3 }, flips: false }),
  c("mateusz", "Kościół św. Mateusza", 3, "kultura", 7, 3, 1, { pay: card1, effect: { poverty: -3 }, flips: false }),
  c("rubinstein", "Koncert Rubinsteina", 3, "kultura", 4, 2, 2, { pay: card1, effect: { pp: 1 }, flips: true }),
  c("rewolucja", "Rewolucja 1905", 3, "nedza", 0, 0, 1, undefined, { event: "strike8" }),
  c("bunt", "Bunt łódzki 1892", 3, "nedza", 0, 0, 1, undefined, { event: "strike8" }),
  c("nocna_zmiana", "Nocna zmiana dzieci", 3, "nedza", 0, 0, 2),
  c("bezrobocie", "Bezrobocie", 3, "nedza", 0, 0, 2),
  c("zakardowa", "Tkalnia żakardowa", 3, "przemysl", 6, 2, 1, { pay: card1, effect: { money: 6 }, flips: false }),
  c("bank_kupiecki", "Bank Kupiecki Łódzki", 3, "wladza", 6, 2, 1, { pay: card1, effect: { money: 5 }, flips: false }),
  c("katedra", "Katedra św. Stanisława Kostki", 3, "kultura", 9, 4, 1, { pay: card1, effect: { poverty: -4 }, flips: false }),
  c("cmentarz_zydowski", "Nowy Cmentarz Żydowski", 3, "kultura", 6, 3, 1, { pay: card1, effect: { poverty: -2 }, flips: false }),
  c("mauzoleum", "Mauzoleum Poznańskich", 3, "kultura", 7, 3, 1, { pay: money(3), effect: { pp: 2 }, flips: false }),
  c("anny_marii", "Szpital Anny Marii", 3, "kultura", 6, 2, 1, { pay: cult1, effect: { poverty: -4 }, flips: true }),
  c("lokaut", "Lokaut 1906", 3, "nedza", 0, 0, 2),
];

const ABOUT: Record<string, string> = {
 "wendisch": "Jedna z pierwszych mechanicznych przędzalni w Łodzi, uruchomiona przez Christiana Wendischa w latach 20. XIX w.",
 "mlyn": "Młyny wodne nad Jasieniem i Łódką były pierwszym napędem łódzkich zakładów.",
 "wodny_rynek": "Rynek przy Piotrkowskiej (dziś plac Zwycięstwa), przy którym Scheibler postawił pierwszą przędzalnię.",
 "kontrakt": "Osadnicy z Saksonii, Śląska i Czech dostawali działki w zamian za osiedlenie się i uruchomienie warsztatu.",
 "sw_trojcy": "Ewangelicki kościół przy Nowym Rynku z lat 1826–1829, dla przybyłych z Niemiec tkaczy.",
 "pozar": "Drewniane domy tkaczy płonęły szybko, a pożar mógł strawić całą ulicę.",
 "kunitzer": "Wielki zakład włókienniczy na Widzewie, założony pod koniec lat 70. XIX w. przez Juliusza Kunitzera.",
 "familoki": "Ceglane domy robotnicze, które Scheibler budował dla swoich pracowników od lat 70. XIX w.",
 "palac_heinzla": "Pałac Juliusza Heinzla przy Piotrkowskiej 104 z lat 80. XIX w.; dziś siedziba władz miasta.",
 "pasaz_meyera": "Prywatna ulica z kamienicami, wytyczona przez Ludwika Meyera w latach 80. XIX w.; dziś ul. Moniuszki.",
 "sw_krzyza": "Katolicki kościół przy dzisiejszej ul. Sienkiewicza z połowy XIX w.",
 "sw_jana": "Ewangelicki kościół przy ul. Sienkiewicza z lat 80. XIX w.",
 "kaplica_scheiblera": "Neogotycka kaplica grobowa Karola Scheiblera na Starym Cmentarzu przy Ogrodowej.",
 "palac_scheiblera": "Rezydencja Scheiblerów przy Wodnym Rynku; dziś Muzeum Kinematografii.",
 "kryzys_bawelniany": "Wojna secesyjna w USA (1861–1865) odcięła dostawy bawełny i zatrzymała przędzalnie.",
 "zakardowa": "Krosna żakardowe tkały wzorzyste tkaniny sterowane kartami perforowanymi.",
 "bank_kupiecki": "Bank łódzkiego kupiectwa, jedna z instytucji finansujących rozwój miasta przed I wojną światową.",
 "katedra": "Neogotycka świątynia przy Piotrkowskiej, budowana w latach 1901–1912.",
 "cmentarz_zydowski": "Cmentarz przy ul. Brackiej, założony w 1892 r., jeden z największych cmentarzy żydowskich w Europie.",
 "mauzoleum": "Grobowiec Izraela i Eleonory Poznańskich na cmentarzu przy Brackiej, bogato zdobiony mozaikami.",
 "anny_marii": "Szpital dziecięcy ufundowany przez rodzinę Scheiblerów i Herbstów na początku XX w.",
 "lokaut": "Na przełomie 1906 i 1907 r. fabrykanci zamknęli zakłady, by złamać ruch strajkowy.",
 "warsztat": "Od 1820 r. Łódź była osadą przemysłową; zaczynano od ręcznych krosien w domach tkaczy.",
 "geyer": "Ludwik Geyer zbudował Białą Fabrykę przy Piotrkowskiej w latach 1835–1839; w 1839 r. stanęła tu pierwsza w Łodzi maszyna parowa.",
 "kolonia": "Osadę Łódka wytyczono w 1824 r. dla tkaczy lnu i bawełny, z działkami ciągnącymi się do rzeki.",
 "farbiarnia": "Rzeki Jasień i Łódka napędzały młyny i dawały wodę farbiarniom i bielnikom.",
 "tkalnia_reczna": "Przed epoką pary sukno i perkal powstawały na ręcznych krosnach.",
 "rembielinski": "Rajmund Rembieliński wytyczył Nowe Miasto z ośmiobocznym rynkiem, dziś placem Wolności.",
 "magistrat": "Klasycystyczny ratusz przy dzisiejszym placu Wolności stoi od 1827 r.",
 "urzad": "Urzędnicy Królestwa Polskiego przydzielali osadnikom działki i pilnowali kontraktów osadniczych.",
 "stary_rynek": "Rynek dawnego rolniczego miasteczka, starszy niż fabryczna Łódź.",
 "szkola": "Pierwsze szkoły elementarne uczyły dzieci osadników czytać i rachować.",
 "stary_cmentarz": "Cmentarz przy Ogrodowej założono w 1855 r.; stoi na nim kaplica grobowa Scheiblerów.",
 "ochronka": "Ochronki zajmowały się dziećmi matek pracujących w fabrykach.",
 "lazaret": "Szpitale i lazarety utrzymywano często z datków fabrykantów.",
 "bezrobotni": "Maszyny wypierały tkaczy ręcznych, wielu traciło jedyne źródło utrzymania.",
 "scheibler": "Karol Scheibler uruchomił przędzalnię przy Wodnym Rynku w 1855 r., a w 1870 r. kupił Księży Młyn.",
 "manufaktura": "Izrael Poznański budował od lat 70. XIX w. kompleks przy Ogrodowej, dziś znany jako Manufaktura.",
 "grohman": "Firmę założył w 1842 r. Traugott Grohman; rozwijali ją syn Ludwik i wnuk Henryk.",
 "heinzel_fabryka": "Juliusz Heinzel zbudował jedną z największych fabryk wełnianych w mieście.",
 "biedermann": "Robert Biedermann postawił farbiarnię nad Łódką przy Widzewskiej w 1864 r.",
 "tkalnia_mech": "Krosna mechaniczne napędzane parą zastąpiły pracę tysięcy tkaczy ręcznych.",
 "wykonczalnia": "W wykończalniach tkaninę bielono, drukowano i apreturowano przed sprzedażą.",
 "przedzalnia_parowa": "Przędzalnie z kominami i maszynami parowymi wyznaczały nową sylwetkę miasta.",
 "bielnik": "Płótno bielono na łąkach nad rzekami, na słońcu i w wodzie.",
 "bank_handlowy": "Bank Handlowy w Łodzi założyli w 1872 r. miejscowi przemysłowcy.",
 "dworzec_fabryczny": "Kolej Fabryczno-Łódzka połączyła miasto z Koluszkami w 1865 r.",
 "tkm": "Towarzystwo Kredytowe Miejskie (1872) udzielało kredytów hipotecznych na budowę kamienic.",
 "straz": "Łódzka Ochotnicza Straż Ogniowa powstała w 1876 r.; pożary drewnianych zabudowań były stałym zagrożeniem.",
 "gielda_bawelny": "Ceny bawełny sprowadzanej z Ameryki i Azji decydowały o zyskach przędzalni.",
 "komitet": "Fabrykanci zrzeszali się, by razem negocjować z władzami i bankami.",
 "victoria": "Teatr przy Piotrkowskiej z lat 80. XIX w., jedna z głównych scen miasta.",
 "grand_hotel": "Grand Hotel przy Piotrkowskiej otwarto 9 października 1887 r.",
 "lodzer_zeitung": "Niemieckojęzyczna gazeta wydawana w Łodzi od 1863 r.",
 "cerkiew": "Prawosławna cerkiew przy Kilińskiego, wzniesiona w latach 1880–1884.",
 "zrodliska": "Najstarszy park Łodzi, założony w latach 40. XIX w. przy źródłach Jasienia.",
 "szkola_rzemiosl": "Szkoły rzemiosł kształciły majstrów i techników dla fabryk.",
 "czytelnia": "Czytelnie ludowe dawały robotnikom dostęp do książek i gazet.",
 "palac_herbsta": "Pałac Edwarda i Matyldy Herbstów na Księżym Młynie, zbudowany w latach 1875–1877.",
 "czynszowki": "Bałuty, przeludnione przedmieście drewniaków i czynszówek, włączono do Łodzi dopiero w 1915 r.",
 "cholera": "Miasto bez kanalizacji nawiedzały epidemie; kanalizację uruchomiono dopiero w 1925 r.",
 "ec1": "Elektrownia miejska przy Targowej ruszyła w 1907 r.",
 "kindermann_fabryka": "Rodzina Kindermannów prowadziła zakłady włókiennicze na Polesiu.",
 "przedzalnia_el": "Na początku XX w. fabryki przechodziły z pary na napęd elektryczny.",
 "farbiarnia_chem": "Barwniki syntetyczne zastąpiły naturalne i zmieniły pracę farbiarni.",
 "tramwaj": "Pierwsze tramwaje elektryczne wyjechały na ulice Łodzi w 1898 r.",
 "dworzec_kaliski": "Dworzec Kolei Warszawsko-Kaliskiej, otwarty w 1902 r.",
 "kolejka": "Podmiejskie linie tramwajowe połączyły Łódź z Pabianicami i Zgierzem.",
 "savoy": "Hotel Savoy przy Traugutta otwarto w 1912 r.",
 "palac_poznanskiego": "Rezydencja Izraela Poznańskiego przy Ogrodowej, rozbudowywana do początku XX w.",
 "willa_kindermanna": "Secesyjna willa Leopolda Kindermanna z 1902 r., projekt Gustawa Landau-Gutentegera.",
 "palac_biedermanna": "Pałac nad Łódką zbudowany w latach 1911–1912; mieszkała w nim rodzina Alfreda Biedermanna.",
 "szkola_kupcow": "Szkoła handlowa ufundowana przez łódzkie kupiectwo.",
 "synagoga": "Synagoga Reicherów w podwórzu kamienicy z przełomu XIX i XX w.; przetrwała II wojnę światową.",
 "mateusz": "Ewangelicki kościół przy Piotrkowskiej, budowany od 1909 r.",
 "rubinstein": "Artur Rubinstein urodził się w Łodzi w 1887 r.",
 "rewolucja": "W czerwcu 1905 r. robotnicy Łodzi wznieśli barykady; walki stłumiło wojsko.",
 "bunt": "W maju 1892 r. strajk powszechny w Łodzi przerodził się w zamieszki, nazwane buntem łódzkim.",
 "nocna_zmiana": "Dzieci pracowały w fabrykach, także nocą, za ułamek płacy dorosłych.",
 "bezrobocie": "Kryzysy w handlu z Rosją zamykały fabryki i wyrzucały robotników na bruk."
};
for (const d of CARDS) d.about = ABOUT[d.id];

export const DECK_SIZE = CARDS.reduce((n, d) => n + d.copies, 0);

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
  { id: "stare_miasto", name: "Stare Miasto", price: 2, cards: 1, pp: 1, start: true, x: 57.5, y: 36.0 },
  { id: "nowe_miasto", name: "Nowe Miasto", price: 3, cards: 1, pp: 2, start: true, x: 60.0, y: 46.0 },
  { id: "lodka", name: "Łódka", price: 2, cards: 1, pp: 1, start: true, x: 72.5, y: 52.0 },
  { id: "srodmiescie", name: "Śródmieście", price: 8, cards: 3, pp: 5, x: 60.0, y: 58.0 },
  { id: "ksiezy_mlyn", name: "Księży Młyn", price: 6, cards: 2, pp: 4, x: 75.0, y: 65.0 },
  { id: "ogrodowa", name: "Ogrodowa", price: 6, cards: 2, pp: 4, x: 45.0, y: 42.0 },
  { id: "widzew", name: "Widzew", price: 5, cards: 2, pp: 3, x: 90.0, y: 50.0 },
  { id: "baluty", name: "Bałuty", price: 2, cards: 2, pp: 1, x: 52.5, y: 24.0 },
  { id: "polesie", name: "Polesie", price: 4, cards: 2, pp: 2, x: 37.5, y: 56.0 },
  { id: "gorna", name: "Górna", price: 4, cards: 2, pp: 2, x: 60.0, y: 74.0 },
  { id: "chojny", name: "Chojny", price: 3, cards: 2, pp: 1, x: 65.0, y: 88.0 },
  { id: "rokicie", name: "Rokicie", price: 3, cards: 2, pp: 1, x: 42.5, y: 76.0 },
  { id: "dabrowa", name: "Dąbrowa", price: 3, cards: 2, pp: 1, x: 80.0, y: 81.0 },
  { id: "zarzew", name: "Zarzew", price: 4, cards: 2, pp: 2, x: 90.0, y: 65.0 },
  { id: "stoki", name: "Stoki", price: 2, cards: 1, pp: 1, x: 87.5, y: 34.0 },
  { id: "radogoszcz", name: "Radogoszcz", price: 2, cards: 1, pp: 1, x: 45.0, y: 12.0 },
  { id: "marysin", name: "Marysin", price: 2, cards: 1, pp: 1, x: 67.5, y: 22.0 },
  { id: "julianow", name: "Julianów", price: 5, cards: 1, pp: 4, x: 32.5, y: 26.0 },
  { id: "lagiewniki", name: "Łagiewniki", price: 3, cards: 1, pp: 3, x: 72.5, y: 9.0 },
  { id: "nowosolna", name: "Nowosolna", price: 3, cards: 1, pp: 2, x: 105.0, y: 36.0 },
  { id: "zgierz", name: "Zgierz", price: 7, cards: 4, pp: 3, town: true, x: 30, y: 6 },
  { id: "aleksandrow", name: "Aleksandrów Łódzki", price: 6, cards: 3, pp: 3, town: true, x: 12, y: 40 },
  { id: "pabianice", name: "Pabianice", price: 7, cards: 4, pp: 3, town: true, x: 28, y: 92 },
  { id: "strykow", name: "Stryków", price: 5, cards: 3, pp: 2, town: true, x: 106, y: 8 },
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

// The curated crisis pool loaded by `npm run db:seed`. After seeding, agendas live in the
// database and can be added, edited or archived from the /admin panel.

export interface SeedAgenda {
  title: string;
  brief: string;
  category: string;
  stakeholders: string[];
  twist: string;
}

export const AGENDA_POOL: SeedAgenda[] = [
  // ---- security ----
  {
    title: "Blockade in the Strait of Hormuz",
    brief:
      "A regional navy has declared a 'temporary inspection zone' across the strait. Tanker traffic is down 40% and insurance rates have tripled overnight.",
    category: "security",
    stakeholders: ["Iran", "United States", "Saudi Arabia", "India", "China", "Oman", "European Union", "Japan"],
    twist: "A tanker has caught fire inside the zone. Each side blames the other, and the crew is still aboard.",
  },
  {
    title: "Rogue Satellite Weapon Test",
    brief:
      "An anti-satellite missile test has scattered 3,000 debris fragments across low-earth orbit, threatening GPS and weather satellites used by every nation.",
    category: "security",
    stakeholders: ["Russia", "United States", "China", "India", "France", "Japan", "Brazil", "African Union"],
    twist: "Debris has just disabled a commercial satellite that provides internet to 12 million people.",
  },
  {
    title: "Mercenary Group Seizes a Gold Mine",
    brief:
      "A private military company has taken control of the largest gold mine in a fragile Sahel state, claiming it is protecting the site under a contract with a former minister.",
    category: "security",
    stakeholders: ["Mali", "France", "Russia", "ECOWAS", "Algeria", "United Kingdom", "African Union", "China"],
    twist: "The group is now offering to hand the mine to whichever government recognises its contract.",
  },
  {
    title: "Contested Election and a Divided Army",
    brief:
      "Two candidates both claim victory in a presidential election. Half the army has declared loyalty to each, and the capital is split down the middle.",
    category: "security",
    stakeholders: ["Domestic Government", "Opposition Coalition", "African Union", "United States", "China", "European Union", "Nigeria", "UN Secretariat"],
    twist: "The electoral commission's servers have been wiped. No independent recount is now possible.",
  },

  // ---- climate ----
  {
    title: "The Glacier Dam Is Failing",
    brief:
      "A glacial lake in the Himalayas is days away from bursting. Three downstream countries dispute who must fund an emergency drainage operation and who must evacuate.",
    category: "climate",
    stakeholders: ["Nepal", "India", "Bangladesh", "China", "Bhutan", "World Bank", "Japan", "European Union"],
    twist: "Satellite data now shows the lake will burst in 36 hours, not 10 days.",
  },
  {
    title: "Geo-engineering Without Permission",
    brief:
      "A billionaire-funded startup has begun releasing sulphur particles into the stratosphere to cool the planet. Monsoon models now predict disruption across South Asia.",
    category: "climate",
    stakeholders: ["United States", "India", "Pakistan", "Small Island States", "China", "European Union", "Brazil", "Saudi Arabia"],
    twist: "The startup reveals it has already sold 'cooling credits' to three national governments.",
  },
  {
    title: "Sinking Capital, Sovereign Seat",
    brief:
      "A Pacific island nation will be uninhabitable within a decade. It asks the Assembly to guarantee its statehood, sea borders and UN seat even after its land disappears.",
    category: "climate",
    stakeholders: ["Tuvalu", "Australia", "New Zealand", "China", "United States", "Fiji", "European Union", "Indonesia"],
    twist: "A neighbouring state offers land for relocation - in exchange for the island's fishing rights.",
  },
  {
    title: "Amazon Tipping Point",
    brief:
      "Scientists warn that a fifth of the Amazon is now emitting more carbon than it absorbs. Donor nations want binding protection zones; rainforest states want payment first.",
    category: "climate",
    stakeholders: ["Brazil", "Colombia", "Peru", "Norway", "Germany", "United States", "Indigenous Peoples' Forum", "China"],
    twist: "A leaked memo shows one donor's state pension fund owns shares in the largest clearing operation.",
  },

  // ---- economy ----
  {
    title: "Sovereign Default Domino",
    brief:
      "A mid-sized emerging economy has missed a bond payment. Two neighbours with the same lenders are seeing capital flee and currencies collapse within hours.",
    category: "economy",
    stakeholders: ["Argentina", "IMF", "China", "United States", "Brazil", "European Union", "Private Creditors' Committee", "G77"],
    twist: "The largest creditor announces it will accept repayment in port and mining concessions instead of cash.",
  },
  {
    title: "Rare Earth Export Ban",
    brief:
      "The world's main processor of rare earth metals has halted exports. Electric car, wind turbine and defence production lines will stop within six weeks.",
    category: "economy",
    stakeholders: ["China", "United States", "Japan", "European Union", "Australia", "DR Congo", "South Korea", "India"],
    twist: "A new deposit has been confirmed - under a protected national park in a non-aligned country.",
  },
  {
    title: "Global Food Price Spike",
    brief:
      "Wheat prices are up 70% after a failed harvest and a shipping corridor closure. Bread subsidies are bankrupting import-dependent states and protests are spreading.",
    category: "economy",
    stakeholders: ["Egypt", "Ukraine", "Russia", "India", "World Food Programme", "United States", "Kenya", "European Union"],
    twist: "Two major exporters announce they will ban exports to protect domestic prices.",
  },
  {
    title: "The Digital Currency Swap",
    brief:
      "A bloc of nations has launched a shared central-bank digital currency to settle trade without the US dollar. Sanctioned states are signing up fast.",
    category: "economy",
    stakeholders: ["BRICS Secretariat", "United States", "Saudi Arabia", "India", "European Central Bank", "Iran", "Brazil", "Singapore"],
    twist: "The system's ledger shows a sanctioned arms dealer moved $2bn through it last week.",
  },

  // ---- health ----
  {
    title: "Outbreak at the Border",
    brief:
      "A novel haemorrhagic fever has appeared in a refugee camp on a busy border. The host country wants to close the crossing; aid agencies say that will spread it further.",
    category: "health",
    stakeholders: ["WHO", "Host Country", "UNHCR", "Neighbouring State", "United States", "Médecins Sans Frontières", "African Union", "China"],
    twist: "A case has been confirmed in a capital city 800km away, in a patient who never visited the camp.",
  },
  {
    title: "Vaccine Patent Standoff",
    brief:
      "A new vaccine is 95% effective against a fast-spreading virus. Its makers will not waive patents, and low-income countries face a two-year wait for supply.",
    category: "health",
    stakeholders: ["South Africa", "India", "European Union", "United States", "WHO", "Pharmaceutical Alliance", "Brazil", "Switzerland"],
    twist: "One low-income country has started producing copies anyway, and its first batch passed safety tests.",
  },
  {
    title: "Antibiotic Resistance in Hospitals",
    brief:
      "A drug-resistant superbug is spreading through hospitals in 14 countries. Overuse of antibiotics in livestock is blamed, but farming lobbies reject new limits.",
    category: "health",
    stakeholders: ["WHO", "United States", "Brazil", "China", "European Union", "India", "FAO", "Australia"],
    twist: "The strain has now been found in bottled drinking water sold in four countries.",
  },
  {
    title: "Ageing Population, Missing Workers",
    brief:
      "Care homes in rich ageing nations are short of half a million workers. They want to recruit nurses abroad, but sending countries say it is gutting their own hospitals.",
    category: "health",
    stakeholders: ["Japan", "Germany", "Philippines", "Nigeria", "United Kingdom", "India", "ILO", "WHO"],
    twist: "One sending country announces a five-year exit ban on newly trained nurses.",
  },

  // ---- technology ----
  {
    title: "AI Deepfake Triggers a Market Crash",
    brief:
      "A fake video of a central bank governor announcing emergency rate hikes wiped $1 trillion off markets in 20 minutes before it was debunked.",
    category: "technology",
    stakeholders: ["United States", "European Union", "China", "United Kingdom", "India", "Tech Platforms Coalition", "IMF", "Singapore"],
    twist: "Investigators trace the video to an AI model released openly by a university lab.",
  },
  {
    title: "Undersea Cable Sabotage",
    brief:
      "Three undersea internet cables have been cut in a single night. Internet capacity to East Africa and the Gulf is down 70%, and banks are offline.",
    category: "technology",
    stakeholders: ["Kenya", "Egypt", "UAE", "India", "United States", "China", "European Union", "ITU"],
    twist: "A commercial ship was seen dragging its anchor over the cables - it is now in a neutral port.",
  },
  {
    title: "Autonomous Weapons Treaty",
    brief:
      "A drone swarm acting without human approval struck a convoy in a border conflict. The Assembly must decide whether to ban, regulate or ignore lethal autonomous weapons.",
    category: "technology",
    stakeholders: ["United States", "Russia", "China", "Austria", "Israel", "Brazil", "South Korea", "ICRC"],
    twist: "The manufacturer says the human operator approved the strike - the operator says they never did.",
  },
  {
    title: "The Data Localisation Wall",
    brief:
      "A large economy will require all citizen data to be stored on domestic servers within 90 days. Foreign platforms threaten to leave, cutting off millions of small businesses.",
    category: "technology",
    stakeholders: ["India", "United States", "European Union", "China", "Indonesia", "Tech Platforms Coalition", "Nigeria", "Japan"],
    twist: "A domestic data centre has just been breached, leaking 50 million identity records.",
  },

  // ---- human rights ----
  {
    title: "Internet Shutdown During Protests",
    brief:
      "A government has shut down mobile internet nationwide for 12 days during mass protests. Reports of arrests are impossible to verify.",
    category: "human-rights",
    stakeholders: ["Domestic Government", "UN Human Rights Council", "United States", "China", "European Union", "Russia", "Amnesty International", "India"],
    twist: "A satellite-internet provider offers to beam free access into the country without permission.",
  },
  {
    title: "Child Labour in the Battery Supply Chain",
    brief:
      "An investigation finds children mining cobalt for batteries sold by the world's biggest electronics brands. Consumers demand action; the mining state needs the revenue.",
    category: "human-rights",
    stakeholders: ["DR Congo", "China", "United States", "European Union", "UNICEF", "Electronics Industry Council", "Zambia", "ILO"],
    twist: "A major brand announces a boycott - which will put 200,000 adult miners out of work.",
  },
  {
    title: "Stateless Children at Sea",
    brief:
      "A boat carrying 300 people, half of them children with no citizenship, has been refused entry by three coastal states and is running out of water.",
    category: "human-rights",
    stakeholders: ["Malaysia", "Indonesia", "Bangladesh", "Myanmar", "Thailand", "UNHCR", "Australia", "ASEAN"],
    twist: "A storm is forecast to hit the boat's position in 18 hours.",
  },
  {
    title: "Surveillance Exports",
    brief:
      "Spyware sold by a private company was used to hack journalists in 20 countries. The company's home state has never refused an export licence.",
    category: "human-rights",
    stakeholders: ["Israel", "European Union", "United States", "Mexico", "Saudi Arabia", "Committee to Protect Journalists", "India", "Hungary"],
    twist: "A list of targets leaks - it includes two delegates sitting in this room.",
  },

  // ---- migration ----
  {
    title: "Climate Migrants Without a Category",
    brief:
      "Millions displaced by drought do not qualify as refugees under the 1951 Convention. Receiving states want to send them back; origin states say there is nothing to return to.",
    category: "migration",
    stakeholders: ["Somalia", "Kenya", "European Union", "UNHCR", "United States", "Bangladesh", "Sudan", "IOM"],
    twist: "A regional court rules that climate displacement can count as persecution.",
  },
  {
    title: "The Border Wall Funding Deal",
    brief:
      "A wealthy bloc offers a transit country $6bn to stop migrants reaching its border. Rights groups call it outsourcing; the transit state calls it a fair price.",
    category: "migration",
    stakeholders: ["European Union", "Türkiye", "Libya", "Greece", "UNHCR", "Germany", "Tunisia", "Human Rights Watch"],
    twist: "The transit state threatens to open its borders if the first payment is late.",
  },
  {
    title: "Brain Drain From a Collapsing Economy",
    brief:
      "Doctors, engineers and teachers are leaving a country in hyperinflation at a rate of 5,000 a month. Neighbours are overwhelmed and the home state wants exit controls.",
    category: "migration",
    stakeholders: ["Venezuela", "Colombia", "Brazil", "United States", "Peru", "IOM", "Spain", "Organization of American States"],
    twist: "A neighbouring country offers fast-track citizenship to any qualified doctor who arrives this year.",
  },
  {
    title: "Seasonal Workers Trapped by Debt",
    brief:
      "Guest workers in a Gulf construction boom report confiscated passports and recruitment debts of up to two years' wages, months before a global sporting event.",
    category: "migration",
    stakeholders: ["Qatar", "Nepal", "India", "Philippines", "ILO", "FIFA", "Bangladesh", "Amnesty International"],
    twist: "A stadium roof collapse injures 40 workers during a heatwave.",
  },
];

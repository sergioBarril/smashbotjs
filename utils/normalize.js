const smashCharacters = require("../params/smashCharacters.json");
const spanishRegions = require("../params/spanishRegions.json");

const normalizeText = (text) =>
  text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

const normalizeCharacter = (characterName) => {
  //  Accepts other ways of calling the characters, and returns the correct one.

  const key = normalizeText(characterName);

  // Check for exact name
  const normalizedCharNames = Object.keys(smashCharacters).map((charName) => {
    return { original: charName, normalized: normalizeText(charName) };
  });

  let original = normalizedCharNames.find((charName) => charName.normalized === key);

  if (original) return original.original;

  // Consider other spellings
  switch (key) {
    // Mario
    case "mario bros":
    case "mario brothers":
    case "fontanero":
      return "Mario";

    // DK
    case "dk":
    case "donkey":
      return "Donkey Kong";

    // Link
    case "zelda verde":
    case "green zelda":
      return "Link";

    // Samus
    case "metroid":
    case "samus aran":
      return "Samus";

    // Dark Samus
    case "damus":
    case "ds":
      return "Dark Samus";

    // Kirby
    case "kirbi":
    case "corbi":
    case "kirbo":
    case "pink ball":
    case "bola rosa":
      return "Kirby";

    // Fox
    case "fots":
    case "fox mccloud":
    case "mccloud":
    case "starfox":
      return "Fox";

    // Pikachu
    case "pika":
      return "Pikachu";

    // Luigi
    case "gooigi":
    case "looigi":
    case "weegee":
    case "mr L":
    case "mario verde":
    case "green mario":
      return "Luigi";

    // Ness
    case "pk boy":
    case "ok":
    case "pkfire":
    case "mother":
    case "earthbound":
    case "yoyo":
      return "Ness";

    // Captain Falcon
    case "capitan falcon":
    case "capita falco":
    case "captain":
    case "falcon":
    case "falcon punch":
      return "Captain Falcon";

    // Jigglypuff
    case "puff":
    case "jiggly":
      return "Jigglypuff";

    // Peach
    case "princess peach":
    case "princesa peach":
      return "Peach";

    // Daisy
    case "princess daisy":
    case "princesa daisy":
      return "Daisy";

    // Ice Climbers
    case "icies":
    case "ics":
    case "ic":
      return "Ice Climbers";

    // Sheik
    case "shiek":
    case "sheikah":
    case "chic":
      return "Sheik";

    // Dr. Mario
    case "doc":
    case "doctor mario":
    case "dr mario":
    case "dr.mario":
    case "drmario":
      return "Dr. Mario";

    // Pichu
    case "pochi":
      return "Pichu";

    // Young Link
    case "yink":
    case "link niño":
      return "Young Link";

    // Ganondorf
    case "ganon":
      return "Ganondorf";

    // Mewtwo
    case "mew":
    case "mewtoo":
    case "mewchu":
    case "mewto":
      return "Mewtwo";

    // Chrom
    case "chrome":
    case "crom":
      return "Chrom";

    // Mr. Game & Watch
    case "gaw":
    case "mr game & watch":
    case "mr game watch":
    case "mr game and watch":
    case "game and watch":
    case "g&w":
    case "gnw":
    case "mr gaw":
    case "gameandwatch":
    case "mr. game and watch":
      return "Mr. Game & Watch";

    // Meta Knight
    case "metaknight":
    case "mk":
    case "metal knight":
      return "Meta Knight";

    // Dark Pit
    case "pittoo":
    case "dpit":
    case "pit sombrio":
    case "pit sombre":
      return "Dark Pit";

    // Zero Suit Samus
    case "zss":
    case "zero samus":
    case "samus zero":
    case "zero suit":
    case "zamus":
    case "zero":
      return "Zero Suit Samus";

    // Snake
    case "metal gear":
    case "solid":
    case "solid snake":
    case "culebra":
      return "Snake";

    // Ike
    case "kike":
      return "Ike";

    // Pokémon Trainer
    case "pokemon":
    case "trainer":
    case "pkmn trainer":
    case "pkmn":
    case "squirtle":
    case "ivysaur":
    case "ivy":
    case "charizard":
    case "chorizard":
      return "Pokémon Trainer";

    // Diddy Kong
    case "diddy":
    case "ddk":
      return "Diddy Kong";

    // King Dedede
    case "dedede":
    case "d3":
    case "rey dedede":
    case "3d":
    case "ddd":
      return "King Dedede";

    // Olimar
    case "alph":
    case "pikmin":
      return "Olimar";

    // R.O.B.
    case "r.o.b":
    case "rob":
    case "robot":
    case "peonza":
      return "R.O.B.";

    // Toon Link
    case "atun":
    case "toon":
    case "tink":
    case "tlink":
      return "Toon Link";

    // Villager
    case "aldeano":
    case "aldeana":
    case "villageois":
      return "Villager";

    // Mega Man
    case "mega":
    case "man":
    case "megaman":
    case "mega-man":
      return "Mega Man";

    // Wii Fit Trainer
    case "wft":
    case "wii fit":
    case "entrenadora":
    case "entrenadora de wii fit":
    case "wtf":
      return "Wii Fit Trainer";

    // Rosalina & Luma
    case "rosalina":
    case "luma":
    case "estela":
    case "estela destello":
    case "destello":
    case "rosalina and luma":
    case "estela y destello":
    case "estela & destello":
      return "Rosalina & Luma";

    // Little Mac
    case "little":
    case "mac":
    case "lmac":
    case "lm":
      return "Little Mac";

    // Mii Swordfighter
    case "mii espadachin":
    case "espadachin":
    case "swordfighter":
    case "mii sword":
    case "mii espada":
      return "Mii Swordfighter";

    // Mii Gunner
    case "gunner":
    case "samus mala":
      return "Mii Gunner";

    // Mii Brawler
    case "mii karateka":
    case "karateka":
    case "mii fighter":
    case "brawler":
      return "Mii Brawler";

    // Palutena
    case "palu":
      return "Palutena";

    // Pac-Man
    case "pacman":
    case "pac man":
    case "pac":
    case "waka":
    case "bunswe":
      return "Pac-Man";

    // Robin
    case "daraen":
      return "Robin";

    // Bowser Jr.
    case "bowser jr":
    case "bjr":
    case "jr":
    case "bj":
    case "bowsy":
    case "larry":
    case "ludwig":
    case "lemmy":
    case "iggy":
    case "morton":
    case "roy koopa":
    case "wendy":
    case "koopaling":
    case "koopalings":
      return "Bowser Jr.";

    // Duck Hunt
    case "duck hunt duo":
    case "dhd":
    case "perro":
    case "perro pato":
    case "perropato":
    case "duckhunt":
    case "duckhuntduo":
    case "dog":
    case "duck":
    case "ddh":
      return "Duck Hunt";

    // Bayonetta
    case "bayonneta":
    case "bayoneta":
    case "bayo":
      return "Bayonetta";

    // Ridley
    case "rydle":
    case "ridel":
    case "ridli":
      return "Ridley";

    // Simon
    case "belmont":
    case "belmonts":
      return "Simon";

    // Richter
    case "richter":
      return "Richter";

    // King K Rool
    case "king k rool":
    case "king rool":
    case "krool":
    case "kingkrool":
    case "king krool":
    case "kkr":
    case "k. rool":
    case "k rool":
    case "cocodrilo":
      return "King K. Rool";

    // Isabelle
    case "canela":
    case "marie":
      return "Isabelle";

    // Incineroar
    case "inci":
    case "incineraor":
      return "Incineroar";

    // Piranha Plant
    case "planta pirana":
    case "pirana":
    case "piranha":
    case "plant piranha":
    case "plant pirana":
    case "pirana plant":
    case "pp":
    case "planta":
    case "plant":
      return "Piranha Plant";

    // Hero
    case "heroe":
    case "dragon quest":
    case "dq":
      return "Hero";

    // Banjo & Kazooie
    case "b&k":
    case "banjo":
    case "kazooie":
    case "banjo and kazooie":
    case "banjokazooie":
    case "banjo&kazooie":
      return "Banjo & Kazooie";

    // Min min
    case "minmin":
    case "min-min":
    case "mien-mien":
      return "Min Min";

    // Steve
    case "minecraft":
    case "esteban":
    case "alex":
    case "zombi":
    case "zombie":
    case "enderman":
    case "ender":
      return "Steve";

    // Sephiroth
    case "sefirot":
    case "sefiroth":
    case "sephirot":
      return "Sephiroth";

    // Pyra/Mythra
    case "pyra":
    case "mythra":
    case "pythra":
    case "aegis":
    case "homura":
    case "hikari":
    case "homura/hikari":
      return "Pyra/Mythra";

    // Kazuya
    case "mishima":
    case "tekken":
      return "Kazuya";

    // Sora
    case "disney":
    case "kingdom hearts":
    case "mickey":
      return "Sora";

    default:
      return null;
  }
};

const normalizeRegion = (regionName) => {
  const key = normalizeText(regionName);

  const normalizedRegionNames = Object.keys(spanishRegions).map((regionName) => {
    return { original: regionName, normalized: normalizeText(regionName) };
  });

  let original = normalizedRegionNames.find((regionName) => regionName.normalized === key);

  if (original) return original.original;

  switch (key) {
    // Albacete
    case "ab":
      return "Albacete";
    // Baleares
    case "islas baleares":
    case "illes balears":
    case "ses illes":
    case "mallorca":
    case "ibiza":
    case "menorca":
    case "eivissa":
      return "Baleares";
    // Canarias
    case "islas canarias":
      return "Canarias";
    // Catalunya
    case "cataluna":
    case "cat":
    case "girona":
    case "tarragona":
    case "lleida":
    case "lerida":
      return "Catalunya";
    // Castellón
    case "castello":
      return "Castellón";
    // Euskadi
    case "pais vasco":
    case "vasco":
    case "eusk":
      return "Euskadi";
    // Galicia
    case "galiza":
    case "gal":
      return "Galicia";
    case "rioja":
    case "rio":
      return "La Rioja";
    case "comunidad valenciana":
    case "comunitat valenciana":
    case "pais valencia":
    case "val":
      return "Valencia";
    default:
      return null;
  }
};

module.exports = {
  normalizeCharacter,
  normalizeRegion,
};

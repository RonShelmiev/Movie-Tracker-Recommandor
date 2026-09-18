import type { Film, Genre, Tag } from '../lib/types';

/**
 * A starter catalogue, hand-curated rather than fetched.
 *
 * Years, directors and runtimes are theatrical-cut figures; where a film has
 * several cuts (Blade Runner, Metropolis, Andrei Rublev) the commonly cited
 * one is used. Point `src/lib/catalogueSource.ts` at TMDB to replace this
 * with the full index — see the README.
 *
 * `acclaim` and `ratingsK` stand in for community consensus and how widely
 * seen a film is. They are editorial estimates, not real ratings data.
 *
 * Columns: id, title, year, runtime, director, country, genres, tags, acclaim, ratingsK, art
 */
type Row = [string, string, number, number, string, string, string, string, number, number, number, string];

const ROWS: Row[] = [
  ['blade-runner', 'Blade Runner', 1982, 117, 'Ridley Scott', 'USA', 'Sci-fi|Neo-noir', 'rain|city-at-night|noir-lighting|ai|slow|practical-fx', 92, 820, 0, 'A burnt-out cop hunts four synthetic people who only want more time. The film that invented how the future looks.'],
  ['blade-runner-2049', 'Blade Runner 2049', 2017, 163, 'Denis Villeneuve', 'USA', 'Sci-fi|Neo-noir', 'rain|city-at-night|noir-lighting|ai|slow|memory|minimal-score', 91, 640, 0, 'Thirty years on, a replicant blade runner turns up a buried secret and goes looking for a man who stopped existing.'],
  ['arrival', 'Arrival', 2016, 116, 'Denis Villeneuve', 'USA', 'Sci-fi|Drama', 'cerebral|grief|memory|slow|minimal-score', 88, 720, 3, 'Twelve ships arrive and a linguist is asked to work out what they want before someone shoots first.'],
  ['sicario', 'Sicario', 2015, 121, 'Denis Villeneuve', 'USA', 'Thriller|Crime', 'bleak|procedural|desert|minimal-score|noir-lighting', 85, 450, 4, 'An FBI agent is seconded to a task force whose rules she is never told, on a border where nobody explains anything.'],
  ['prisoners', 'Prisoners', 2013, 153, 'Denis Villeneuve', 'USA', 'Thriller|Crime|Drama', 'bleak|rain|procedural|grief', 84, 720, 5, 'Two girls go missing and a father decides the police are moving too slowly. A long, wet, morally filthy film.'],
  ['enemy', 'Enemy', 2013, 91, 'Denis Villeneuve', 'Canada', 'Thriller|Mystery', 'cerebral|twist|bleak|city-at-night', 76, 240, 1, 'A teacher spots his exact double in a film and cannot leave it alone. Ends on the single strangest shot of the decade.'],
  ['dune', 'Dune', 2021, 155, 'Denis Villeneuve', 'USA', 'Sci-fi|Action', 'desert|blockbuster|slow|space', 84, 800, 2, 'A ducal heir is handed a desert planet and a war he was bred for. Part one of two.'],
  ['dune-part-two', 'Dune: Part Two', 2024, 166, 'Denis Villeneuve', 'USA', 'Sci-fi|Action', 'desert|blockbuster|space|practical-fx', 88, 560, 2, 'The heir becomes the thing the desert was waiting for, and the film is honest about how bad that is.'],
  ['stalker', 'Stalker', 1979, 161, 'Andrei Tarkovsky', 'USSR', 'Sci-fi|Drama', 'slow|long-take|arthouse|cerebral|minimal-score|bleak', 90, 130, 6, 'A guide leads two men through a forbidden zone toward a room that grants your deepest wish. Almost nothing happens, at length.'],
  ['solaris', 'Solaris', 1972, 167, 'Andrei Tarkovsky', 'USSR', 'Sci-fi|Drama', 'slow|long-take|arthouse|space|grief|memory|cerebral', 87, 110, 7, 'A psychologist is sent to a station orbiting an ocean that reads minds and returns the dead.'],
  ['andrei-rublev', 'Andrei Rublev', 1966, 205, 'Andrei Tarkovsky', 'USSR', 'Drama|War', 'slow|long-take|arthouse|bleak', 88, 60, 2, 'An icon painter loses his faith across eight chapters of medieval Russian cruelty, then finds it in a bell.'],
  ['mirror', 'Mirror', 1975, 107, 'Andrei Tarkovsky', 'USSR', 'Drama', 'slow|arthouse|memory|grief|long-take', 85, 55, 7, 'A dying man remembers, out of order, without explanation. The most beautiful film about not being able to say what you mean.'],
  ['annihilation', 'Annihilation', 2018, 115, 'Alex Garland', 'USA', 'Sci-fi|Horror', 'body-horror|cerebral|grief|bleak', 79, 320, 4, 'A biologist walks into a zone where physics has started refracting, looking for what happened to her husband.'],
  ['ex-machina', 'Ex Machina', 2014, 108, 'Alex Garland', 'UK', 'Sci-fi|Thriller', 'ai|one-location|cerebral|twist|minimal-score', 84, 560, 5, 'A coder is flown out to a billionaire glass box to run a Turing test, and is the last to work out what is being tested.'],
  ['her', 'Her', 2013, 126, 'Spike Jonze', 'USA', 'Sci-fi|Romance|Drama', 'ai|grief|city-at-night|cerebral', 83, 640, 3, 'A lonely man falls in love with an operating system, and the film refuses to make that a joke.'],
  ['under-the-skin', 'Under the Skin', 2013, 108, 'Jonathan Glazer', 'UK', 'Sci-fi|Horror', 'slow|bleak|minimal-score|arthouse|rain', 78, 130, 1, 'Something wearing a woman drives around Glasgow collecting men. Shot half-hidden, with non-actors.'],
  ['children-of-men', 'Children of Men', 2006, 109, 'Alfonso Cuaron', 'UK', 'Sci-fi|Drama|Thriller', 'dystopia|long-take|bleak|rain|practical-fx', 89, 620, 2, 'Eighteen years into global infertility, a bureaucrat is asked to move one pregnant woman across a collapsing Britain.'],
  ['gravity', 'Gravity', 2013, 91, 'Alfonso Cuaron', 'USA', 'Sci-fi|Thriller', 'space|long-take|blockbuster|grief', 79, 520, 6, 'Debris takes out a shuttle and one doctor has to get home. Essentially a ninety-minute held breath.'],
  ['roma', 'Roma', 2018, 135, 'Alfonso Cuaron', 'Mexico', 'Drama', 'slow|long-take|arthouse|grief', 85, 180, 7, 'A year in the life of a domestic worker in 1970s Mexico City, remembered in enormous black-and-white detail.'],
  ['y-tu-mama-tambien', 'Y Tu Mama Tambien', 2001, 106, 'Alfonso Cuaron', 'Mexico', 'Drama', 'arthouse|long-take', 81, 130, 3, 'Two teenagers and an older woman drive to a beach that may not exist. Much sadder than it first looks.'],
  ['moon', 'Moon', 2009, 97, 'Duncan Jones', 'UK', 'Sci-fi|Drama', 'space|one-location|ai|cerebral|twist|practical-fx', 81, 380, 6, 'A contractor is two weeks from the end of a three-year solo shift when he finds someone else on the base.'],
  ['primer', 'Primer', 2004, 77, 'Shane Carruth', 'USA', 'Sci-fi', 'cerebral|time-loop|twist|one-location', 74, 110, 0, 'Two engineers build a time machine in a garage and refuse to explain any of it to you.'],
  ['upstream-color', 'Upstream Color', 2013, 96, 'Shane Carruth', 'USA', 'Sci-fi|Drama', 'cerebral|arthouse|memory|minimal-score|slow', 71, 35, 7, 'A parasite, a pig farm, and two people trying to work out which of their memories are theirs.'],
  ['coherence', 'Coherence', 2013, 89, 'James Ward Byrkit', 'USA', 'Sci-fi|Thriller', 'one-location|twist|cerebral|ensemble', 72, 95, 1, 'A comet passes over a dinner party and the houses on the street stop being the same house.'],
  ['gattaca', 'Gattaca', 1997, 106, 'Andrew Niccol', 'USA', 'Sci-fi|Drama', 'dystopia|cerebral|noir-lighting', 78, 320, 3, 'In a world sorted by genome, a man borrows someone else DNA to get into space.'],
  ['the-matrix', 'The Matrix', 1999, 136, 'Lana and Lilly Wachowski', 'USA', 'Sci-fi|Action', 'dystopia|blockbuster|city-at-night|practical-fx|ai', 87, 1900, 4, 'A hacker is told the world is a rendering and given a choice about knowing it.'],
  ['akira', 'Akira', 1988, 124, 'Katsuhiro Otomo', 'Japan', 'Animation|Sci-fi', 'anime|dystopia|city-at-night|body-horror', 85, 260, 5, 'A biker gang member develops powers Neo-Tokyo cannot survive. Hand-drawn at a level nobody has matched.'],
  ['ghost-in-the-shell', 'Ghost in the Shell', 1995, 83, 'Mamoru Oshii', 'Japan', 'Animation|Sci-fi|Neo-noir', 'anime|ai|rain|city-at-night|cerebral|memory', 84, 210, 0, 'A cyborg officer chases a hacker and starts wondering what exactly is doing the chasing.'],
  ['perfect-blue', 'Perfect Blue', 1997, 81, 'Satoshi Kon', 'Japan', 'Animation|Thriller|Mystery', 'anime|twist|memory|city-at-night|bleak', 82, 130, 1, 'A pop idol turns actress and loses track of which of her is real. Aronofsky has been borrowing from it ever since.'],
  ['paprika', 'Paprika', 2006, 90, 'Satoshi Kon', 'Japan', 'Animation|Sci-fi', 'anime|memory|cerebral|stylish', 79, 95, 2, 'A device that records dreams is stolen, and the dreams start leaking into the street.'],
  ['spirited-away', 'Spirited Away', 2001, 125, 'Hayao Miyazaki', 'Japan', 'Animation|Drama', 'anime|arthouse', 88, 800, 6, 'A sulky ten-year-old has to work in a bathhouse for spirits to get her parents turned back from pigs.'],
  ['princess-mononoke', 'Princess Mononoke', 1997, 134, 'Hayao Miyazaki', 'Japan', 'Animation|Action|Drama', 'anime|bleak|ensemble', 86, 450, 7, 'A cursed prince walks into a war between an iron town and the forest, and refuses to pick a side.'],
  ['alien', 'Alien', 1979, 117, 'Ridley Scott', 'UK', 'Sci-fi|Horror', 'space|one-location|body-horror|practical-fx|bleak', 89, 900, 5, 'A tow crew answers a distress signal. Industrial, slow, and still the best-designed film in the genre.'],
  ['aliens', 'Aliens', 1986, 137, 'James Cameron', 'USA', 'Sci-fi|Action|Horror', 'space|ensemble|practical-fx|blockbuster', 85, 750, 4, 'The same nightmare, this time with marines who are certain they will be fine.'],
  ['the-thing', 'The Thing', 1982, 109, 'John Carpenter', 'USA', 'Horror|Sci-fi', 'one-location|body-horror|practical-fx|bleak|minimal-score', 86, 470, 6, 'Something in the Antarctic ice can be anyone. Nobody can be trusted, including the ending.'],
  ['videodrome', 'Videodrome', 1983, 87, 'David Cronenberg', 'Canada', 'Horror|Sci-fi', 'body-horror|city-at-night|cerebral|practical-fx', 76, 110, 1, 'A sleazy TV executive finds a signal that rewrites the people who watch it.'],
  ['2001', '2001: A Space Odyssey', 1968, 149, 'Stanley Kubrick', 'UK', 'Sci-fi|Drama', 'space|slow|ai|cerebral|arthouse|practical-fx', 90, 700, 7, 'Apes, a monolith, a computer with better manners than the crew, and eighteen minutes nobody has fully explained.'],
  ['metropolis', 'Metropolis', 1927, 153, 'Fritz Lang', 'Germany', 'Sci-fi|Drama', 'dystopia|city-at-night|arthouse|practical-fx', 85, 190, 3, 'The city runs on people underneath it. Ninety-nine years old and still the template.'],
  ['brazil', 'Brazil', 1985, 132, 'Terry Gilliam', 'UK', 'Sci-fi|Comedy|Drama', 'dystopia|satire|practical-fx|bleak', 82, 200, 2, 'A clerical error condemns a man, and the paperwork is the villain. Funny until it very much is not.'],
  ['twelve-monkeys', 'Twelve Monkeys', 1995, 129, 'Terry Gilliam', 'USA', 'Sci-fi|Thriller', 'time-loop|dystopia|memory|twist|bleak', 81, 640, 5, 'A convict is sent back to find the source of a plague and cannot tell what he remembers from what he is doing.'],
  ['la-jetee', 'La Jetee', 1962, 28, 'Chris Marker', 'France', 'Sci-fi|Drama', 'time-loop|memory|arthouse|minimal-score|cerebral', 87, 45, 0, 'Told almost entirely in still photographs: a man sent back through his own strongest memory. The seed of Twelve Monkeys.'],
  ['minority-report', 'Minority Report', 2002, 145, 'Steven Spielberg', 'USA', 'Sci-fi|Thriller', 'dystopia|procedural|blockbuster|noir-lighting', 79, 560, 4, 'A cop who arrests people before they offend is flagged by his own system.'],
  ['total-recall', 'Total Recall', 1990, 113, 'Paul Verhoeven', 'USA', 'Sci-fi|Action', 'memory|practical-fx|blockbuster|satire', 74, 350, 3, 'A construction worker buys a memory of a holiday on Mars and stops being sure of anything after that.'],
  ['robocop', 'RoboCop', 1987, 102, 'Paul Verhoeven', 'USA', 'Sci-fi|Action', 'satire|dystopia|practical-fx|city-at-night', 78, 300, 5, 'Detroit privatises its police force. A cartoon on the surface and vicious underneath.'],
  ['snowpiercer', 'Snowpiercer', 2013, 126, 'Bong Joon-ho', 'South Korea', 'Sci-fi|Action', 'dystopia|one-location|satire|ensemble', 77, 380, 1, 'The last people alive are on a train, sorted by carriage. They go forward one car at a time.'],
  ['parasite', 'Parasite', 2019, 132, 'Bong Joon-ho', 'South Korea', 'Thriller|Drama', 'satire|twist|ensemble|rain', 89, 900, 2, 'One family works its way into another family house. The tonal handbrake turn halfway through is the point.'],
  ['memories-of-murder', 'Memories of Murder', 2003, 132, 'Bong Joon-ho', 'South Korea', 'Crime|Thriller|Drama', 'procedural|bleak|rain|noir-lighting', 87, 160, 6, 'Two rural detectives fail, for years, to catch a serial killer. Ends on a look straight down the lens.'],
  ['oldboy', 'Oldboy', 2003, 120, 'Park Chan-wook', 'South Korea', 'Thriller|Mystery', 'twist|bleak|stylish|memory', 83, 480, 0, 'A man is imprisoned in a room for fifteen years, released without explanation, and given five days.'],
  ['the-handmaiden', 'The Handmaiden', 2016, 145, 'Park Chan-wook', 'South Korea', 'Thriller|Romance|Drama', 'twist|stylish|ensemble', 85, 190, 1, 'A con, told three times, each version rearranging who was doing what to whom.'],
  ['burning', 'Burning', 2018, 148, 'Lee Chang-dong', 'South Korea', 'Mystery|Drama', 'slow|arthouse|bleak|cerebral', 82, 85, 7, 'A young man suspects a rich acquaintance of something he cannot name and has no evidence for.'],
  ['drive', 'Drive', 2011, 100, 'Nicolas Winding Refn', 'USA', 'Neo-noir|Crime', 'stylish|city-at-night|minimal-score|noir-lighting|bleak', 80, 680, 4, 'A stunt driver moonlights as a getaway. Eighty minutes of restraint and twenty of appalling violence.'],
  ['nightcrawler', 'Nightcrawler', 2014, 117, 'Dan Gilroy', 'USA', 'Neo-noir|Thriller|Crime', 'city-at-night|bleak|satire|noir-lighting', 82, 570, 5, 'A freelance crime cameraman works out that if you arrive first, you can arrange the shot.'],
  ['heat', 'Heat', 1995, 170, 'Michael Mann', 'USA', 'Crime|Neo-noir|Thriller', 'city-at-night|procedural|ensemble|noir-lighting', 86, 720, 6, 'A crew and the detective chasing them, both very good at a job that is eating them.'],
  ['collateral', 'Collateral', 2004, 120, 'Michael Mann', 'USA', 'Neo-noir|Thriller', 'city-at-night|noir-lighting|stylish|one-location', 79, 400, 0, 'A cab driver picks up a fare who has five stops to make. Shot on early digital, which is why LA looks like that.'],
  ['chinatown', 'Chinatown', 1974, 130, 'Roman Polanski', 'USA', 'Neo-noir|Mystery|Drama', 'noir-lighting|procedural|bleak|desert', 88, 320, 3, 'A private investigator follows a marital case into the question of who owns the water.'],
  ['the-conversation', 'The Conversation', 1974, 113, 'Francis Ford Coppola', 'USA', 'Neo-noir|Thriller|Drama', 'surveillance|cerebral|bleak|one-location|minimal-score', 85, 130, 7, 'A surveillance expert replays a recording until he hears something, then cannot stop hearing it.'],
  ['blow-out', 'Blow Out', 1981, 108, 'Brian De Palma', 'USA', 'Neo-noir|Thriller', 'surveillance|stylish|city-at-night|bleak', 78, 75, 2, 'A sound man records a car crash and realises he has a gunshot on tape. A brutal last five minutes.'],
  ['se7en', 'Se7en', 1995, 127, 'David Fincher', 'USA', 'Crime|Thriller|Neo-noir', 'rain|bleak|procedural|noir-lighting|city-at-night', 86, 1500, 1, 'Two detectives work a case organised around the deadly sins, in a city where it will not stop raining.'],
  ['zodiac', 'Zodiac', 2007, 157, 'David Fincher', 'USA', 'Crime|Mystery|Drama', 'procedural|bleak|surveillance|slow', 84, 480, 6, 'Not about catching a killer. About what the not-catching does to the people who try.'],
  ['the-social-network', 'The Social Network', 2010, 120, 'David Fincher', 'USA', 'Drama', 'procedural|satire|ensemble|cerebral', 83, 720, 4, 'A deposition, cut against the founding of a company by people who did not like each other.'],
  ['memento', 'Memento', 2000, 113, 'Christopher Nolan', 'USA', 'Neo-noir|Mystery|Thriller', 'memory|twist|cerebral|noir-lighting', 84, 1300, 5, 'A man who cannot form new memories hunts his wife killer, told backwards so you know as little as he does.'],
  ['inception', 'Inception', 2010, 148, 'Christopher Nolan', 'USA', 'Sci-fi|Action|Thriller', 'cerebral|blockbuster|ensemble|memory|practical-fx', 85, 2400, 2, 'A crew breaks into a mind to leave an idea rather than take one.'],
  ['interstellar', 'Interstellar', 2014, 169, 'Christopher Nolan', 'USA', 'Sci-fi|Drama', 'space|blockbuster|grief|cerebral|practical-fx', 84, 1900, 7, 'A pilot leaves his daughter to look for a planet that will take us. The maths is load-bearing.'],
  ['tenet', 'Tenet', 2020, 150, 'Christopher Nolan', 'USA', 'Sci-fi|Action|Thriller', 'time-loop|blockbuster|cerebral|practical-fx', 72, 560, 3, 'Objects that move backwards through time, and a plot that assumes you will watch it twice.'],
  ['no-country-for-old-men', 'No Country for Old Men', 2007, 122, 'Joel and Ethan Coen', 'USA', 'Crime|Thriller|Neo-noir', 'desert|bleak|minimal-score|procedural', 88, 1000, 5, 'A welder takes a case of money from a scene in the desert, and something patient starts walking after him.'],
  ['fargo', 'Fargo', 1996, 98, 'Joel and Ethan Coen', 'USA', 'Crime|Comedy|Thriller', 'satire|bleak|procedural|ensemble', 85, 720, 6, 'A car salesman arranges his own wife kidnapping, badly, in a lot of snow.'],
  ['mulholland-drive', 'Mulholland Drive', 2001, 147, 'David Lynch', 'USA', 'Mystery|Neo-noir|Drama', 'memory|arthouse|city-at-night|noir-lighting|twist', 86, 380, 1, 'A dream about Hollywood that turns, at a specific moment, into what the dream was covering.'],
  ['lost-highway', 'Lost Highway', 1997, 134, 'David Lynch', 'USA', 'Neo-noir|Mystery|Horror', 'memory|arthouse|city-at-night|noir-lighting|surveillance', 76, 130, 0, 'A saxophonist starts receiving videotapes of the inside of his own house.'],
  ['taxi-driver', 'Taxi Driver', 1976, 114, 'Martin Scorsese', 'USA', 'Neo-noir|Drama|Crime', 'city-at-night|bleak|noir-lighting|rain', 87, 900, 2, 'An insomniac cab driver decides somebody should do something about the city.'],
  ['the-third-man', 'The Third Man', 1949, 104, 'Carol Reed', 'UK', 'Neo-noir|Mystery|Thriller', 'noir-lighting|city-at-night|procedural|stylish', 89, 190, 3, 'A writer arrives in occupied Vienna for a friend funeral and finds the wrong number of pallbearers.'],
  ['double-indemnity', 'Double Indemnity', 1944, 107, 'Billy Wilder', 'USA', 'Neo-noir|Crime|Drama', 'noir-lighting|bleak|procedural', 87, 160, 4, 'An insurance salesman and a client wife plan a perfect accident. Narrated by a man bleeding out.'],
  ['wind-river', 'Wind River', 2017, 107, 'Taylor Sheridan', 'USA', 'Crime|Thriller|Drama', 'bleak|procedural|desert|grief', 76, 250, 6, 'A tracker and a young FBI agent work a death on a Wyoming reservation, in weather that is itself a suspect.'],
  ['hell-or-high-water', 'Hell or High Water', 2016, 102, 'David Mackenzie', 'USA', 'Crime|Drama', 'desert|procedural|bleak|ensemble', 80, 220, 7, 'Two brothers rob the branches of the bank foreclosing on their mother ranch.'],
  ['zero-dark-thirty', 'Zero Dark Thirty', 2012, 157, 'Kathryn Bigelow', 'USA', 'Thriller|Drama|War', 'procedural|bleak|surveillance|ensemble', 78, 300, 0, 'A decade of intelligence work compressed into one analyst refusal to drop a thread.'],
  ['michael-clayton', 'Michael Clayton', 2007, 119, 'Tony Gilroy', 'USA', 'Thriller|Drama', 'procedural|city-at-night|bleak|cerebral', 79, 160, 1, 'A law firm fixer is handed a class action that his own side is losing on purpose.'],
  ['mad-max-fury-road', 'Mad Max: Fury Road', 2015, 120, 'George Miller', 'Australia', 'Action|Sci-fi', 'desert|practical-fx|blockbuster|dystopia', 87, 1100, 3, 'One chase, out and back, told almost entirely with real vehicles and almost no dialogue.'],
  ['sunshine', 'Sunshine', 2007, 107, 'Danny Boyle', 'UK', 'Sci-fi|Thriller', 'space|one-location|ensemble|bleak', 72, 280, 6, 'A crew carries a bomb to restart the sun and makes one detour too many.'],
  ['the-fifth-element', 'The Fifth Element', 1997, 126, 'Luc Besson', 'France', 'Sci-fi|Action|Comedy', 'blockbuster|stylish|city-at-night|practical-fx', 71, 480, 2, 'A cab driver, an opera singer and the end of the world, in the loudest production design ever built.'],
  ['looper', 'Looper', 2012, 119, 'Rian Johnson', 'USA', 'Sci-fi|Thriller|Crime', 'time-loop|noir-lighting|twist|bleak', 76, 620, 5, 'A hitman kills people sent back from the future, until the person kneeling in the field is himself.'],
  ['edge-of-tomorrow', 'Edge of Tomorrow', 2014, 113, 'Doug Liman', 'USA', 'Sci-fi|Action', 'time-loop|blockbuster|practical-fx', 75, 720, 4, 'A PR officer is dropped into an invasion and starts the same day again every time he dies.'],
  ['everything-everywhere', 'Everything Everywhere All at Once', 2022, 139, 'Daniel Kwan and Daniel Scheinert', 'USA', 'Sci-fi|Action|Comedy|Drama', 'ensemble|grief|blockbuster|cerebral', 83, 700, 1, 'A laundromat owner in the middle of an audit is asked to save every version of herself.'],
  ['in-the-mood-for-love', 'In the Mood for Love', 2000, 98, 'Wong Kar-wai', 'Hong Kong', 'Romance|Drama', 'stylish|slow|rain|arthouse|city-at-night', 88, 130, 0, 'Two neighbours work out their spouses are having an affair, and decide not to be like them.'],
  ['chungking-express', 'Chungking Express', 1994, 102, 'Wong Kar-wai', 'Hong Kong', 'Romance|Drama|Comedy', 'stylish|city-at-night|arthouse', 84, 110, 2, 'Two loosely joined stories about policemen getting over people, at speed, in neon.'],
  ['paris-texas', 'Paris, Texas', 1984, 145, 'Wim Wenders', 'Germany', 'Drama', 'desert|slow|arthouse|grief|minimal-score', 86, 90, 3, 'A man walks out of the desert after four years missing and has to be reassembled by his family.'],
  ['wings-of-desire', 'Wings of Desire', 1987, 128, 'Wim Wenders', 'Germany', 'Drama|Romance', 'slow|arthouse|city-at-night|grief', 84, 70, 7, 'Angels over Berlin listen to everyone thoughts, and one of them decides he would rather have coffee.'],
  ['come-and-see', 'Come and See', 1985, 142, 'Elem Klimov', 'USSR', 'War|Drama', 'bleak|long-take|arthouse', 88, 90, 5, 'A boy joins the partisans in occupied Belarus. The hardest watch on this list, and worth it once.'],
  ['there-will-be-blood', 'There Will Be Blood', 2007, 158, 'Paul Thomas Anderson', 'USA', 'Drama', 'desert|bleak|slow|minimal-score', 87, 520, 6, 'An oil prospector acquires land, a church, and no capacity for other people.'],
  ['the-master', 'The Master', 2012, 144, 'Paul Thomas Anderson', 'USA', 'Drama', 'slow|arthouse|bleak|cerebral', 79, 190, 4, 'A drifting veteran attaches himself to a man inventing a religion.'],
  ['lost-in-translation', 'Lost in Translation', 2003, 102, 'Sofia Coppola', 'USA', 'Drama|Romance|Comedy', 'city-at-night|slow|grief|stylish', 80, 480, 1, 'Two insomniac Americans in a Tokyo hotel keep each other company for a week.'],
];

function parse(row: Row): Film {
  const [id, title, year, runtime, director, country, genres, tags, acclaim, ratingsK, art, synopsis] = row;
  return {
    id,
    title,
    year,
    runtime,
    director,
    country,
    genres: genres.split('|') as Genre[],
    tags: tags.split('|') as Tag[],
    acclaim,
    ratingsK,
    art,
    synopsis,
  };
}

export const CATALOGUE: Film[] = ROWS.map(parse);

const BY_ID = new Map(CATALOGUE.map((f) => [f.id, f]));

export function getFilm(id: string): Film | undefined {
  return BY_ID.get(id);
}

/** Ordered by how recognisable they are — used to seed a brand new library. */
export const FIRST_RUN_PICKS: string[] = [
  'blade-runner', 'the-matrix', 'alien', 'arrival', 'akira',
  'drive', 'her', 'parasite', 'mad-max-fury-road', 'se7en',
  'inception', 'spirited-away',
];

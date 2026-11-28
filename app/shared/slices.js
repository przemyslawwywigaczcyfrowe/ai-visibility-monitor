/* ============================ AI VISIBILITY ============================
   Static panel on GitHub Pages, no build step. The code is cut into vertical slices:
   every feature has its own folder in app/slices/ with its view, its click handlers, its part of
   the address and its styles. app/shared/ holds only what at least two slices use,
   app/shell/ is the frame around the views (rail, store switcher, filter bar, address).

   A slice registers itself with PLASTER(name, definition). The frame knows no slice by name,
   it only asks the registry. Fields of a definition, all optional:

   nazwa               name shown in the rail and in the usage log
   menu                { ikona, dol, title }: the slice gets a button in the rail, in the order of the script tags
   rysuj()             returns the HTML of the view; a slice with rysuj is a view, its name is the first part of the address
   podepnij()          attaches click handlers after the view (or, for a slice without a view, after every view) is drawn
   stan                { field: default } added to the shared state S
   naSklep             the view shows one store (the store switcher marks the store)
   filtry              the view uses the filter bar (run, compare, engine, topic, search); implies naSklep
   grupa()             true when the view now shows all stores together
   naWszystkie()       what a click on "All stores" does inside this view (default: go to the main view)
   poKliknieciuSklepu()  runs after a store is picked in the store switcher
   adres()             builds the whole address of the view (default: #/view/store?filters)
   doAdresu(q)         adds the slice's own parameters to the address
   zAdresu(q, sciezka) reads the slice's own parameters from the address
   poAdresie(ok)       runs after a view opened from an address is drawn
   wczytaj()           loads the slice's own data at sign-in (may return a promise)
   poRysowaniu()       runs after every draw, before the handlers are attached
   poZalogowaniu()     runs once, after sign-in
   przyciskFiltrow(), podepnijFiltry()  a button of the slice in the filter bar
   zamknij()           closes what the slice has open on top of the view
   ======================================================================= */
var PLASTRY = {};
/* Shared state: the open view and store, and the filters of the store views. Slices add their own fields ("stan"). */
var S = { view: 'all', market: 'PL', engine: 'all', run: null, cmp: null, topic: '', q: '', bez4: false };
/* The three views the frame links to by name. */
var WIDOK_GLOWNY = 'all', WIDOK_SKLEPU = 'summary', WIDOK_DZIENNIKA = 'how';
function PLASTER(nazwa, def) {
  PLASTRY[nazwa] = def;
  if (def.stan) Object.keys(def.stan).forEach(function (k) { S[k] = def.stan[k]; });
}
/* Calls one hook in every slice that has it, in the order of registration. Returns the results. */
function zbierz(hak, a, b) {
  var w = [];
  Object.keys(PLASTRY).forEach(function (k) { if (PLASTRY[k][hak]) w.push(PLASTRY[k][hak](a, b)); });
  return w;
}

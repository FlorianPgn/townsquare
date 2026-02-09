const NEWPLAYER = {
  name: "",
  id: "",
  role: {},
  reminders: [],
  isVoteless: false,
  isDead: false,
  pronouns: "",
};

const state = () => ({
  players: [],
  fabled: [],
  bluffs: [],
});

const getters = {
  alive({ players }) {
    return players.filter((player) => !player.isDead).length;
  },
  nonTravelers({ players }) {
    const nonTravelers = players.filter(
      (player) => player.role.team !== "traveler",
    );
    return Math.min(nonTravelers.length, 15);
  },
  // calculate a Map of player => night order
  nightOrder({ players, fabled }) {
    const firstNight = [0];
    const otherNight = [0];
    fabled.forEach((role) => {
      if (role.firstNight) {
        firstNight.push(role);
      }
      if (role.otherNight) {
        otherNight.push(role);
      }
    });
    players.forEach((player) => {
      if (player.role.firstNight) {
        firstNight.push(player);
      }
      if (player.role.otherNight) {
        otherNight.push(player);
      }
    });
    // If x has an attribute 'role' (meaning x is a player), then, to know their night order, we look at x.role.firstNight or x.role.otherNight
    // Else, (meaning x is instead a Fabled), to know their night order we look at x.firstNight or x.otherNight
    firstNight.sort(
      (a, b) =>
        (a.role ? a.role.firstNight : a.firstNight) -
        (b.role ? b.role.firstNight : b.firstNight),
    );
    otherNight.sort(
      (a, b) =>
        (a.role ? a.role.otherNight : a.otherNight) -
        (b.role ? b.role.otherNight : b.otherNight),
    );
    const nightOrder = new Map();
    players.forEach((player) => {
      const first = Math.max(firstNight.indexOf(player), 0);
      const other = Math.max(otherNight.indexOf(player), 0);
      nightOrder.set(player, { first, other });
    });
    fabled.forEach((role) => {
      const first = Math.max(firstNight.indexOf(role), 0);
      const other = Math.max(otherNight.indexOf(role), 0);
      nightOrder.set(role, { first, other });
    });
    return nightOrder;
  },
};

const actions = {
  randomize({ state, commit }) {
    const players = state.players
      .map((a) => [Math.random(), a])
      .sort((a, b) => a[0] - b[0])
      .map((a) => a[1]);
    commit("set", players);
  },
  clearReminders({ state, commit }) {
    state.players.forEach((player) => {
      if (player.reminders.length) {
        commit("update", { player, property: "reminders", value: [] });
      }
    });
  },
  smartShuffle({ state, commit }) {
    const players = state.players;
    if (players.length < 3) return;
    const original = players.slice();
    const count = original.length;
    const originalNeighbors = new Map();

    for (let i = 0; i < count; i++) {
      const left = original[(i - 1 + count) % count];
      const right = original[(i + 1) % count];
      originalNeighbors.set(original[i], new Set([left, right]));
    }

    const scoreArrangement = (arrangement) => {
      let score = 0;
      for (let i = 0; i < count; i++) {
        const player = arrangement[i];
        const left = arrangement[(i - 1 + count) % count];
        const right = arrangement[(i + 1) % count];
        const neighbors = originalNeighbors.get(player);
        if (neighbors.has(left)) score++;
        if (neighbors.has(right)) score++;
      }
      return score;
    };

    const shuffle = (arr) =>
      arr
        .map((a) => [Math.random(), a])
        .sort((a, b) => a[0] - b[0])
        .map((a) => a[1]);

    // Try multiple random shuffles and pick the one with fewest shared neighbors.
    let best = shuffle(original);
    let bestScore = scoreArrangement(best);
    for (let i = 0; i < 200 && bestScore > 0; i++) {
      const candidate = shuffle(original);
      const candidateScore = scoreArrangement(candidate);
      if (candidateScore < bestScore) {
        best = candidate;
        bestScore = candidateScore;
      }
    }

    commit("set", best);
  },
  clearRoles({ state, commit, rootState }) {
    let players;
    if (rootState.session.isSpectator) {
      players = state.players.map((player) => {
        if (player.role.team !== "traveler") {
          player.role = {};
        }
        player.reminders = [];
        return player;
      });
    } else {
      players = state.players.map(({ name, id, pronouns }) => ({
        ...NEWPLAYER,
        name,
        id,
        pronouns,
      }));
    }
    commit("set", players);
    commit("setBluff");
  },
};

const mutations = {
  clear(state) {
    state.players = [];
    state.bluffs = [];
    state.fabled = [];
  },
  set(state, players = []) {
    state.players = players;
  },
  /**
  The update mutation also has a property for isFromSockets
  this property can be addded to payload object for any mutations
  then can be used to prevent infinite loops when a property is
  able to be set from multiple different session on websockets.
  An example of this is in the sendPlayerPronouns and _updatePlayerPronouns
  in socket.js.
   */
  update(state, { player, property, value }) {
    const index = state.players.indexOf(player);
    if (index >= 0) {
      state.players[index][property] = value;
    }
  },
  add(state, name) {
    state.players.push({
      ...NEWPLAYER,
      name,
    });
  },
  remove(state, index) {
    state.players.splice(index, 1);
  },
  swap(state, [from, to]) {
    [state.players[from], state.players[to]] = [
      state.players[to],
      state.players[from],
    ];
    // hack: "modify" the array so that Vue notices something changed
    state.players.splice(0, 0);
  },
  move(state, [from, to]) {
    state.players.splice(to, 0, state.players.splice(from, 1)[0]);
  },
  rotate(state, steps = 1) {
    const count = state.players.length;
    if (!count) return;
    const normalized = ((steps % count) + count) % count;
    if (!normalized) return;
    state.players = state.players
      .slice(count - normalized)
      .concat(state.players.slice(0, count - normalized));
  },
  setBluff(state, { index, role } = {}) {
    if (index !== undefined) {
      state.bluffs.splice(index, 1, role);
    } else {
      state.bluffs = [];
    }
  },
  setFabled(state, { index, fabled } = {}) {
    if (index !== undefined) {
      state.fabled.splice(index, 1);
    } else if (fabled) {
      if (!Array.isArray(fabled)) {
        state.fabled.push(fabled);
      } else {
        state.fabled = fabled;
      }
    }
  },
};

export default {
  namespaced: true,
  state,
  getters,
  actions,
  mutations,
};

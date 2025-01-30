<template>
  <Modal class="roles" v-if="modals.roles && nonTravelers >= 5" @close="toggleModal('roles')">
    <h3>
      {{
        locale.modal.roles.titleStart +
        nonTravelers +
        locale.modal.roles.titleEnd
      }}
    </h3>
    <ul class="tokens" v-for="(teamRoles, team) in roleSelection" :key="team">
      <li class="count" :class="[team]">
        {{ teamRoles.reduce((a, { selected }) => a + selected, 0) }} /
        {{ game[nonTravelers - 5][team] }}
      </li>
      <li v-for="role in teamRoles" :class="[role.team, role.selected ? 'selected' : '']" :key="role.id"
        @click="role.selected = role.selected ? 0 : 1">
        <Token :role="role" />
        <font-awesome-icon icon="exclamation-triangle" class="fa fa-exclamation-triangle" v-if="role.setup" />
        <div class="buttons" v-if="allowMultiple || role.multiple">
          <font-awesome-icon icon="minus-circle" @click.stop="role.selected--" />
          <span>{{ role.selected > 1 ? "x" + role.selected : "" }}</span>
          <font-awesome-icon icon="plus-circle" class="fa fa-plus-circle" @click.stop="role.selected++" />
        </div>
      </li>
    </ul>
    <ul class="tokens">
      <li v-for="role in fabledWithSetup" :class="['fabled', 'selected']" :key="role.id">
        <Token :role="role" />
        <font-awesome-icon icon="exclamation-triangle" class="fa fa-exclamation-triangle" />
      </li>
    </ul>
    <div class="warning" v-if="hasSelectedSetupRoles || fabledWithSetup.length">
      <font-awesome-icon icon="exclamation-triangle" class="fa fa-exclamation-triangle" />
      <span>{{ locale.modal.roles.warning }}</span>
    </div>
    <label class="multiple" :class="{ checked: allowMultiple }">
      <font-awesome-icon :icon="allowMultiple ? 'check-square' : 'square'" />
      <input type="checkbox" name="allow-multiple" v-model="allowMultiple" />
      {{ locale.modal.roles.allowMultiple }}
    </label>
    <div class="button-group">
      <div class="button" @click="assignRoles" :class="{
        disabled: selectedRoles > nonTravelers || !selectedRoles,
      }">
        <font-awesome-icon icon="people-arrows" class="fa fa-people-arrows" />
        {{
          locale.modal.roles.assignStart +
          selectedRoles +
          locale.modal.roles.assignEnd
        }}
      </div>
      <div class="button" @click="selectRandomRoles">
        <font-awesome-icon icon="random" class="fa fa-random" />
        {{ locale.modal.roles.shuffle }}
      </div>
      <div class="button" @click="exportPrintable">
        <font-awesome-icon icon="file-pdf" />
        Export Tokens
      </div>
    </div>
  </Modal>
</template>

<script setup>
import { computed, ref, onMounted, watch } from 'vue';
import { useStore } from 'vuex';
import Modal from "./Modal.vue";
import gameJSON from "../../game.json";
import Token from "../Token.vue";

const papyrusUrl = new URL('../../assets/fonts/papyrus.ttf', import.meta.url).href;
const tokenBgUrl = new URL('../../assets/token.png', import.meta.url).href;
const leafLeftUrl = new URL('../../assets/leaf-left.png', import.meta.url).href;
const leafRightUrl = new URL('../../assets/leaf-right.png', import.meta.url).href;
const leafOrangeUrl = new URL('../../assets/leaf-orange.png', import.meta.url).href;

const getRoleImageUrl = (role) => {
  console.log(role);
  return new URL(
    `../../assets/icons/${role.id}.png`,
    import.meta.url
  ).href;
};

const randomElement = (arr) => arr[Math.floor(Math.random() * arr.length)];

const store = useStore();

const roleSelection = ref({});
const game = ref(gameJSON);
const allowMultiple = ref(false);

const roles = computed(() => store.state.roles);
const modals = computed(() => store.state.modals);
const locale = computed(() => store.state.locale);
const players = computed(() => store.state.players.players);
const fabled = computed(() => store.state.players.fabled);
const nonTravelers = computed(() => store.getters['players/nonTravelers']);

const selectedRoles = computed(() => {
  return Object.values(roleSelection.value)
    .map((roles) => roles.reduce((a, { selected }) => a + selected, 0))
    .reduce((a, b) => a + b, 0);
});

const hasSelectedSetupRoles = computed(() => {
  return Object.values(roleSelection.value).some((roles) =>
    roles.some((role) => role.selected && role.setup),
  );
});

const fabledWithSetup = computed(() => {
  let res = [];
  for (const fable of fabled.value) {
    if (fable.setup) {
      res.push(fable);
    }
  }
  return res;
});

const selectRandomRoles = () => {
  roleSelection.value = {};
  roles.value.forEach((role) => {
    if (!roleSelection.value[role.team]) {
      roleSelection.value[role.team] = [];
    }
    roleSelection.value[role.team].push(role);
    role.selected = 0;
  });
  delete roleSelection.value["traveler"];
  const playerCount = Math.max(5, nonTravelers.value);
  const composition = game.value[playerCount - 5];
  Object.keys(composition).forEach((team) => {
    for (let x = 0; x < composition[team]; x++) {
      if (roleSelection.value[team]) {
        const available = roleSelection.value[team].filter(
          (role) => !role.selected,
        );
        if (available.length) {
          randomElement(available).selected = 1;
        }
      }
    }
  });
};

const assignRoles = () => {
  if (selectedRoles.value <= nonTravelers.value && selectedRoles.value) {
    // generate list of selected roles and randomize it
    const roles = Object.values(roleSelection.value)
      .map((roles) =>
        roles
          // duplicate roles selected more than once and filter unselected
          .reduce((a, r) => [...a, ...Array(r.selected).fill(r)], []),
      )
      // flatten into a single array
      .reduce((a, b) => [...a, ...b], [])
      .map((a) => [Math.random(), a])
      .sort((a, b) => a[0] - b[0])
      .map((a) => a[1]);
    players.value.forEach((player) => {
      if (player.role.team !== "traveler" && roles.length) {
        const value = roles.pop();
        store.commit("players/update", {
          player,
          property: "role",
          value,
        });
      }
    });
    store.commit("toggleModal", "roles");
  }
};

const exportPrintable = () => {
  // Get selected roles
  const selectedRoles = Object.values(roleSelection.value)
    .flatMap(roles => 
      roles.filter(role => role.selected)
        .flatMap(role => Array(role.selected).fill(role))
    );

  // Create HTML content
  const htmlContent = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <title>Character Tokens</title>
        <style>
          @font-face {
            font-family: "Papyrus";
            src: url("${papyrusUrl}") format("truetype");
          }
          body { 
            display: flex;
            flex-wrap: wrap;
            gap: 20px;
            padding: 20px;
            justify-content: center;
          }
          .token-wrapper {
            width: 150px;
            height: 150px;
            page-break-inside: avoid;
          }
          .token {
            width: 100%;
            height: 100%;
            border-radius: 50%;
            background: url("${tokenBgUrl}") center center;
            background-size: 100%;
            text-align: center;
            border: 3px solid black;
            box-shadow: 0 0 10px rgba(0, 0, 0, 0.5);
            display: flex;
            align-items: center;
            justify-content: center;
            position: relative;
            overflow: hidden;
          }
          .icon {
            position: absolute;
            width: 100%;
            height: 100%;
            background-position: center 30%;
            background-repeat: no-repeat;
            background-size: 100%;
            margin-top: 3%;
            z-index: 1;
          }
          .name {
            width: 100%;
            height: 100%;
            font-size: 24px;
            position: relative;
            z-index: 2;
          }
          .label {
            fill: black;
            stroke: white;
            stroke-width: 2px;
            paint-order: stroke;
            font-family: "Papyrus", serif;
            font-weight: bold;
            text-shadow: 0 2px 2px rgba(0, 0, 0, 0.2);
            letter-spacing: 1px;
          }
          .leaf-left, .leaf-right, .leaf-orange {
            position: absolute;
            width: 100%;
            height: 100%;
            background-size: 100%;
            background-repeat: no-repeat;
          }
          .leaf-left {
            background-image: url("${leafLeftUrl}");
          }
          .leaf-right {
            background-image: url("${leafRightUrl}");
          }
          .leaf-orange {
            background-image: url("${leafOrangeUrl}");
          }
          @media print {
            @page { margin: 1cm; }
            body { gap: 10px; }
            .token-wrapper {
              width: 120px;
              height: 120px;
            }
          }
        </style>
      </head>
      <body>
        ${selectedRoles.map(role => {
          const roleImageUrl = getRoleImageUrl(role);
          return `
            <div class="token-wrapper">
              <div class="token ${role.team}">
                <span 
                  class="icon" 
                  style="background-image: url('${roleImageUrl}')">
                </span>
                <svg viewBox="0 0 150 150" class="name">
                  <path
                    d="M 13 75 C 13 160, 138 160, 138 75"
                    id="curve-${role.id}"
                    fill="transparent"
                  />
                  <text
                    width="150"
                    x="66.6%"
                    text-anchor="middle"
                    class="label"
                    font-size="${role.name && role.name.length > 10 ? '90%' : '110%'}"
                  >
                    <textPath xlink:href="#curve-${role.id}">
                      ${role.name}
                    </textPath>
                  </text>
                </svg>
                ${role.firstNight || role.firstNightReminder ? '<span class="leaf-left"></span>' : ''}
                ${role.otherNight || role.otherNightReminder ? '<span class="leaf-right"></span>' : ''}
                ${role.setup ? '<span class="leaf-orange"></span>' : ''}
              </div>
            </div>
          `;
        }).join('')}
      </body>
    </html>
  `;

  // Create blob and object URL
  const blob = new Blob([htmlContent], { type: 'text/html' });
  const url = URL.createObjectURL(blob);

  // Open in new tab
  const newTab = window.open(url, '_blank');

  // Clean up the object URL after the new tab is loaded
  if (newTab) {
    newTab.onload = () => {
      URL.revokeObjectURL(url);
    };
  }
};

const toggleModal = (modal) => {
  store.commit("toggleModal", modal);
};

onMounted(() => {
  if (!Object.keys(roleSelection.value).length) {
    selectRandomRoles();
  }
});

watch(roles, () => {
  selectRandomRoles();
});
</script>

<style lang="scss" scoped>
@use "../../vars.scss" as *;

ul.tokens {
  padding-left: 5vmin;
  margin-top: 5px;

  li {
    border-radius: 50%;
    width: 5vmax;
    margin: 5px;
    opacity: 0.5;
    transition: all 250ms;

    &.selected {
      opacity: 1;

      .buttons {
        display: flex;
      }

      .fa-exclamation-triangle {
        display: block;
      }
    }

    &.townsfolk {
      box-shadow:
        0 0 10px $townsfolk,
        0 0 10px #004cff;
    }

    &.outsider {
      box-shadow:
        0 0 10px $outsider,
        0 0 10px $outsider;
    }

    &.minion {
      box-shadow:
        0 0 10px $minion,
        0 0 10px $minion;
    }

    &.demon {
      box-shadow:
        0 0 10px $demon,
        0 0 10px $demon;
    }

    &.traveler {
      box-shadow:
        0 0 10px $traveler,
        0 0 10px $traveler;
    }

    &.fabled {
      box-shadow:
        0 0 10px $fabled,
        0 0 10px $fabled;
    }

    &:hover {
      transform: scale(1.2);
      z-index: 10;
    }

    .fa-exclamation-triangle {
      position: absolute;
      color: red;
      filter: drop-shadow(0 0 3px black) drop-shadow(0 0 3px black);
      top: 5px;
      right: -5px;
      font-size: 150%;
      display: none;
    }

    .buttons {
      display: none;
      position: absolute;
      top: 95%;
      text-align: center;
      width: 100%;
      z-index: 30;
      font-weight: bold;
      filter: drop-shadow(0 0 5px rgba(0, 0, 0, 1));

      span {
        flex-grow: 1;
      }

      svg {
        opacity: 0.25;
        cursor: pointer;

        &:hover {
          opacity: 1;
          color: red;
        }
      }
    }
  }

  .count {
    opacity: 1;
    position: absolute;
    left: 0;
    font-weight: bold;
    font-size: 75%;
    width: 5%;
    display: flex;
    align-items: center;
    justify-content: center;

    &:after {
      content: " ";
      display: block;
      padding-top: 100%;
    }

    &.townsfolk {
      color: $townsfolk;
    }

    &.outsider {
      color: $outsider;
    }

    &.minion {
      color: $minion;
    }

    &.demon {
      color: $demon;
    }
  }
}

.roles .modal {
  .multiple {
    display: block;
    text-align: center;
    cursor: pointer;
    margin-top: 20px;

    &.checked,
    &:hover {
      color: red;
    }

    svg {
      margin-right: 5px;
    }

    input {
      display: none;
    }
  }

  .warning {
    color: red;
    position: absolute;
    bottom: 20px;
    right: 20px;
    z-index: 10;

    svg {
      font-size: 150%;
      vertical-align: middle;
    }

    span {
      display: none;
      text-align: center;
      position: absolute;
      right: -20px;
      bottom: 30px;
      width: 420px;
      background: rgba(0, 0, 0, 0.75);
      padding: 5px;
      border-radius: 10px;
      border: 2px solid black;
    }

    &:hover span {
      display: block;
    }
  }
}
</style>

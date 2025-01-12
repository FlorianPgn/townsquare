<template>
    <select v-model="selectedLanguage" @change="changeLanguage">
      <option value="en">English</option>
      <option value="fr">Français</option>
    </select>
  </template>
  
  <script setup>
  import { ref } from 'vue';
  import { useStore } from 'vuex';
  
  const store = useStore();
  const selectedLanguage = ref(store.state.locale.language);
  
  const changeLanguage = async () => {
    await store.dispatch('setLanguage', selectedLanguage.value);
  };
  </script>
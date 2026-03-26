export const USE_NEW_ENGINE =
    typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).get('engine') === 'new'

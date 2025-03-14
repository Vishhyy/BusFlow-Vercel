import sveltePreprocess from "svelte-preprocess";
import adapter from '@sveltejs/adapter-vercel';

const config = {
  preprocess: sveltePreprocess(),
  kit: {
    adapter: adapter()
  }
};

export default config;

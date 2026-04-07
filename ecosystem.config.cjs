module.exports = {
  apps: [{
    name: "bigspace",
    script: "dist/index.cjs",
    env_production: {
      NODE_ENV: "production",
    },
  }],
};

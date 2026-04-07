module.exports = {
  apps: [{
    name: "bigspace",
    script: "dist/index.cjs",
    cwd: "/home/rocky/BIGSPACE-public",
    env_production: {
      NODE_ENV: "production",
    },
  }],
};

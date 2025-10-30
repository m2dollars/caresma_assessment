module.exports = function override(config, env) {
  // Webpack Dev Server configuration
  if (env === 'development') {
    config.devServer = {
      ...config.devServer,
      allowedHosts: 'all',
      host: 'localhost',
    };
  }
  return config;
};


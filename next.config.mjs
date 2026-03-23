const config = {
  reactStrictMode: true,
  async rewrites() {
    return [
      {
        source: "/registrácia-trénera",
        destination: "/registracia-trenera"
      },
      {
        source: "/registr%C3%A1cia-tr%C3%A9nera",
        destination: "/registracia-trenera"
      }
    ];
  },
  compiler: {
    removeConsole: process.env.NODE_ENV === "production"
  }
};

export default config;

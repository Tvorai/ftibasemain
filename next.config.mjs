const config = {
  reactStrictMode: true,
  async rewrites() {
    return [
      {
        source: "/registrácia",
        destination: "/registracia"
      },
      {
        source: "/registr%C3%A1cia",
        destination: "/registracia"
      },
      {
        source: "/prihlásenie",
        destination: "/prihlasenie"
      },
      {
        source: "/prihl%C3%A1senie",
        destination: "/prihlasenie"
      },
      {
        source: "/registrácia-trénera",
        destination: "/registracia-trenera"
      },
      {
        source: "/registr%C3%A1cia-tr%C3%A9nera",
        destination: "/registracia-trenera"
      },
      {
        source: "/prihlásenie-trénera",
        destination: "/prihlasenie-trenera"
      },
      {
        source: "/prihl%C3%A1senie-tr%C3%A9nera",
        destination: "/prihlasenie-trenera"
      }
    ];
  },
  compiler: {
    removeConsole: process.env.NODE_ENV === "production"
  }
};

export default config;

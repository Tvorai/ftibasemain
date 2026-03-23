import type { Messages } from "../index";

const sk: Messages = {
  common: {
    brand: "Fitbase",
    language: "Jazyk",
    menu: {
      home: "Domov",
      userDashboard: "Účet",
      trainerDashboard: "Účet trénera",
      bookings: "História rezervácií",
      payments: "História platieb",
      settings: "Nastavenia"
    }
  },
  pages: {
    trainerProfile: {
      title: "Profil trénera",
      description: "Verejná stránka trénera s ponukou služieb."
    },
    trainerRegistration: {
      title: "Registrácia trénera",
      subtitle: "Posuňte svoju profesiu na nový level",
      fields: {
        fullName: "Meno a priezvisko",
        email: "Email",
        password: "Heslo",
        passwordRepeat: "Opakovať heslo"
      },
      submit: "Registrovať"
    },
    userDashboard: {
      title: "Používateľský dashboard",
      description: "Prehľad tréningov, rezervácií a platieb."
    },
    trainerDashboard: {
      title: "Trénerský dashboard",
      description: "Správa klientov, kalendára a ponuky."
    },
    bookings: {
      title: "História rezervácií"
    },
    payments: {
      title: "História platieb"
    },
    settings: {
      title: "Nastavenia",
      languageLabel: "Vyberte jazyk"
    }
  }
};

export default sk;

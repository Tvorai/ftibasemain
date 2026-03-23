import type { Messages } from "../index";

const cs: Messages = {
  common: {
    brand: "Fitbase",
    language: "Jazyk",
    menu: {
      home: "Domů",
      userDashboard: "Účet",
      trainerDashboard: "Účet trenéra",
      bookings: "Historie rezervací",
      payments: "Historie plateb",
      settings: "Nastavení"
    }
  },
  pages: {
    trainerProfile: {
      title: "Profil trenéra",
      description: "Veřejná stránka trenéra s nabídkou služeb."
    },
    trainerRegistration: {
      title: "Registrace trenéra",
      subtitle: "Posuňte svou profesi na nový level",
      fields: {
        fullName: "Jméno a příjmení",
        email: "Email",
        password: "Heslo",
        passwordRepeat: "Zopakovat heslo"
      },
      submit: "Registrovat"
    },
    userDashboard: {
      title: "Uživatelský dashboard",
      description: "Přehled tréninků, rezervací a plateb."
    },
    trainerDashboard: {
      title: "Trenérský dashboard",
      description: "Správa klientů, kalendáře a nabídky."
    },
    bookings: {
      title: "Historie rezervací"
    },
    payments: {
      title: "Historie plateb"
    },
    settings: {
      title: "Nastavení",
      languageLabel: "Vyberte jazyk"
    }
  }
};

export default cs;

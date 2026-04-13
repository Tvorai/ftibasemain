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
    userRegistration: {
      title: "Registrace",
      subtitle: "Vytvořte si účet a začněte si rezervovat služby",
      fields: {
        fullName: "Jméno a příjmení",
        email: "Email",
        password: "Heslo",
        passwordRepeat: "Zopakovat heslo"
      },
      submit: "Registrovat"
    },
    userLogin: {
      title: "Přihlášení",
      subtitle: "Přihlaste se do svého účtu",
      fields: {
        email: "Email",
        password: "Heslo"
      },
      submit: "Přihlásit se",
      forgotPasswordHint: "Zapomněli jste heslo?",
      forgotPasswordTitle: "Reset hesla",
      forgotPasswordSubtitle: "Zadejte svůj e-mail pro zaslání odkazu na resetování hesla",
      forgotPasswordSubmit: "Odeslat",
      backToLogin: "Zpět na přihlášení",
      resetEmailSent: "Odkaz na resetování hesla byl odeslán na váš e-mail.",
      resetPasswordTitle: "Nastavení nového hesla",
      resetPasswordSubmit: "Změnit heslo",
      resetPasswordSuccess: "Vaše heslo bylo úspěšně změněno. Nyní se můžete přihlásit."
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

export type Locale = "sk" | "cs";

export type Messages = {
  common: {
    brand: string;
    language: string;
    menu: {
      home: string;
      userDashboard: string;
      trainerDashboard: string;
      bookings: string;
      payments: string;
      settings: string;
    };
  };
  pages: {
    trainerProfile: {
      title: string;
      description: string;
    };
    trainerRegistration: {
      title: string;
      subtitle: string;
      fields: {
        fullName: string;
        email: string;
        password: string;
        passwordRepeat: string;
      };
      submit: string;
    };
    userRegistration: {
      title: string;
      subtitle: string;
      fields: {
        fullName: string;
        email: string;
        password: string;
        passwordRepeat: string;
      };
      submit: string;
    };
    userLogin: {
      title: string;
      subtitle: string;
      fields: {
        email: string;
        password: string;
      };
      submit: string;
      forgotPasswordHint: string;
    };
    userDashboard: {
      title: string;
      description: string;
    };
    trainerDashboard: {
      title: string;
      description: string;
    };
    bookings: {
      title: string;
    };
    payments: {
      title: string;
    };
    settings: {
      title: string;
      languageLabel: string;
    };
  };
};

import sk from "./locales/sk";
import cs from "./locales/cs";

export const dictionaries: Record<Locale, Messages> = { sk, cs };

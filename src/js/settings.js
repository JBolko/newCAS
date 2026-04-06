// src/js/settings.js

export const settings = {
    // Ting eleven kan ændre på (senere i et UI)
    user: {
        theme: 'light',
        fontSize: 14,
        decimalSeparator: ',',
        angleMode: 'deg' // Vigtigt: 'deg' eller 'rad'
    },
    // Ting som maskinrummet skal bruge
    engine: {
        precision: 10,
        timeout: 5000,
        defaultDomain: 'Reals'
    },

    // Hjælpefunktioner til at gemme indstillinger i browseren
    save() {
        localStorage.setItem('newcas_settings', JSON.stringify({
            user: this.user,
            engine: this.engine
        }));
    },

    load() {
        const saved = localStorage.getItem('newcas_settings');
        if (saved) {
            const data = JSON.parse(saved);
            this.user = { ...this.user, ...data.user };
            this.engine = { ...this.engine, ...data.engine };
        }
    }
};

// Hent gemte indstillinger med det samme
settings.load();
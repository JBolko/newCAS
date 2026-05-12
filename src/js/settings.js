/**
 * settings.js
 * Singleton med bruger- og motorindstillinger.
 *
 * Understøtter observers: andre moduler kan abonnere på ændringer
 * til specifikke indstillinger med settings.onChange(key, callback).
 *
 * Brug:
 *   settings.set('angleMode', 'rad');           // opdaterer + notificerer
 *   settings.onChange('angleMode', m => ...);   // abonnér
 */

// ─── Interne data ─────────────────────────────────────────────────────────────

const _defaults = {
    user: {
        theme:            'light',
        fontSize:         14,
        decimalSeparator: ',',
        angleMode:        'deg',   // 'deg' | 'rad'
    },
    engine: {
        precision:     10,
        defaultDomain: 'Reals',
        // timeout er ikke implementeret endnu — tilføjes når WebWorker-arkitekturen
        // er på plads (Fase 5 i roadmap). Defineres ikke her for ikke at love noget.
    },
};

// Observers: Map<key, Set<callback>>
const _observers = new Map();

// ─── Eksporteret singleton ────────────────────────────────────────────────────

export const settings = {
    user:   { ..._defaults.user },
    engine: { ..._defaults.engine },

    // ── Læsning ───────────────────────────────────────────────────────────────

    /** Henter en brugerindstilling. Typisk bruges settings.user.x direkte. */
    get(key) {
        return this.user[key] ?? this.engine[key];
    },

    // ── Skrivning ─────────────────────────────────────────────────────────────

    /**
     * Opdaterer en brugerindstilling og notificerer alle observers.
     * Gem i localStorage sker automatisk.
     *
     * @param {string} key   - Nøgle i settings.user (fx 'angleMode')
     * @param {*}      value - Den nye værdi
     */
    set(key, value) {
        const old = this.user[key];
        if (old === value) return;          // ingen ændring, ingen notifikation

        this.user[key] = value;
        this.save();
        this._notify(key, value, old);
    },

    // ── Observer-API ──────────────────────────────────────────────────────────

    /**
     * Abonnér på ændringer til en specifik indstilling.
     * Returnerer en unsubscribe-funktion.
     *
     * Eksempel:
     *   const unsub = settings.onChange('angleMode', mode => engine.setAngleMode(mode));
     *   // Senere: unsub();
     *
     * @param {string}   key      - Indstillingsnøgle at lytte på
     * @param {Function} callback - Kaldes med (newValue, oldValue)
     * @returns {Function} unsubscribe
     */
    onChange(key, callback) {
        if (!_observers.has(key)) _observers.set(key, new Set());
        _observers.get(key).add(callback);
        return () => _observers.get(key).delete(callback);
    },

    /** @private */
    _notify(key, newValue, oldValue) {
        _observers.get(key)?.forEach(cb => {
            try { cb(newValue, oldValue); }
            catch (err) { console.error(`settings.onChange('${key}') kastede:`, err); }
        });
    },

    // ── Persistens ────────────────────────────────────────────────────────────

    save() {
        try {
            localStorage.setItem('newcas_settings', JSON.stringify({
                user:   this.user,
                engine: this.engine,
            }));
        } catch (err) {
            console.warn('Kunne ikke gemme settings i localStorage:', err);
        }
    },

    load() {
        try {
            const raw = localStorage.getItem('newcas_settings');
            if (!raw) return;
            const data = JSON.parse(raw);
            // Merge ind i defaults — gemte felter vinder, nye defaults bevares
            if (data.user)   this.user   = { ..._defaults.user,   ...data.user };
            if (data.engine) this.engine = { ..._defaults.engine, ...data.engine };
        } catch (err) {
            console.warn('Kunne ikke indlæse settings fra localStorage:', err);
        }
    },

    /** Nulstil til fabriksindstillinger og slet localStorage. */
    reset() {
        this.user   = { ..._defaults.user };
        this.engine = { ..._defaults.engine };
        localStorage.removeItem('newcas_settings');
        // Notificer alle observers om reset
        for (const key of _observers.keys()) {
            this._notify(key, this.user[key] ?? this.engine[key], undefined);
        }
    },
};

// Indlæs gemte indstillinger straks — men som en eksplicit handling, ikke en
// usynlig side-effekt af importen. Kaldet er synligt her i bunden af filen.
settings.load();

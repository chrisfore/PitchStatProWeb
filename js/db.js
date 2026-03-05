// Database layer using sql.js (SQLite compiled to WebAssembly)
const DB = (() => {
    let db = null;
    let _onSaveError = null;
    const DB_KEY = 'pitchstatpro_db';

    async function init() {
        const SQL = await initSqlJs({
            locateFile: file => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.3/${file}`
        });

        const saved = localStorage.getItem(DB_KEY);
        if (saved) {
            const buf = Uint8Array.from(atob(saved), c => c.charCodeAt(0));
            db = new SQL.Database(buf);
        } else {
            db = new SQL.Database();
        }

        db.run(`CREATE TABLE IF NOT EXISTS players (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT UNIQUE NOT NULL
        )`);
        db.run(`CREATE TABLE IF NOT EXISTS zones (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT UNIQUE NOT NULL
        )`);
        db.run(`CREATE TABLE IF NOT EXISTS pitch_types (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT UNIQUE NOT NULL
        )`);
        db.run(`CREATE TABLE IF NOT EXISTS pitches (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            player TEXT NOT NULL,
            pitch_type TEXT NOT NULL,
            zone TEXT NOT NULL,
            result TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            uuid TEXT UNIQUE
        )`);

        save();
        return db;
    }

    function save() {
        if (!db) return;
        const data = db.export();
        const arr = new Uint8Array(data);
        let binary = '';
        const chunkSize = 8192;
        for (let i = 0; i < arr.length; i += chunkSize) {
            binary += String.fromCharCode.apply(null, arr.subarray(i, i + chunkSize));
        }
        try {
            localStorage.setItem(DB_KEY, btoa(binary));
        } catch (e) {
            console.error('Failed to save database:', e);
            if (typeof _onSaveError === 'function') _onSaveError();
        }
    }

    function run(sql, params = []) {
        db.run(sql, params);
        save();
    }

    function query(sql, params = []) {
        const stmt = db.prepare(sql);
        stmt.bind(params);
        const results = [];
        while (stmt.step()) {
            results.push(stmt.getAsObject());
        }
        stmt.free();
        return results;
    }

    function getOne(sql, params = []) {
        const results = query(sql, params);
        return results.length > 0 ? results[0] : null;
    }

    // Players
    function getPlayers() {
        return query('SELECT name FROM players ORDER BY name');
    }

    function addPlayer(name) {
        const trimmed = name.trim();
        if (!trimmed) return false;
        try {
            run('INSERT INTO players (name) VALUES (?)', [trimmed]);
            return true;
        } catch { return false; }
    }

    function renamePlayer(oldName, newName) {
        const trimmed = newName.trim();
        if (!trimmed) return false;
        try {
            run('UPDATE players SET name = ? WHERE name = ?', [trimmed, oldName]);
            run('UPDATE pitches SET player = ? WHERE player = ?', [trimmed, oldName]);
            return true;
        } catch { return false; }
    }

    function removePlayer(name) {
        run('DELETE FROM players WHERE name = ?', [name]);
        run('DELETE FROM pitches WHERE player = ?', [name]);
    }

    // Pitch Types
    function getPitchTypes() {
        return query('SELECT name FROM pitch_types ORDER BY name');
    }

    function addPitchType(name) {
        const trimmed = name.trim();
        if (!trimmed) return false;
        try {
            run('INSERT INTO pitch_types (name) VALUES (?)', [trimmed]);
            return true;
        } catch { return false; }
    }

    function renamePitchType(oldName, newName) {
        const trimmed = newName.trim();
        if (!trimmed) return false;
        try {
            run('UPDATE pitch_types SET name = ? WHERE name = ?', [trimmed, oldName]);
            run('UPDATE pitches SET pitch_type = ? WHERE pitch_type = ?', [trimmed, oldName]);
            return true;
        } catch { return false; }
    }

    function removePitchType(name) {
        run('DELETE FROM pitch_types WHERE name = ?', [name]);
    }

    // Zones
    function getZones() {
        return query('SELECT name FROM zones ORDER BY name');
    }

    function addZone(name) {
        const trimmed = name.trim();
        if (!trimmed) return false;
        try {
            run('INSERT INTO zones (name) VALUES (?)', [trimmed]);
            return true;
        } catch { return false; }
    }

    function renameZone(oldName, newName) {
        const trimmed = newName.trim();
        if (!trimmed) return false;
        try {
            run('UPDATE zones SET name = ? WHERE name = ?', [trimmed, oldName]);
            // Update zones in pitches (zone field may contain "Zone1 / Zone2")
            const escaped = oldName.replace(/[%_]/g, '\\$&');
            const pitches = query("SELECT id, zone FROM pitches WHERE zone LIKE ? ESCAPE '\\'", [`%${escaped}%`]);
            for (const p of pitches) {
                const parts = p.zone.split(' / ').map(z => z === oldName ? trimmed : z);
                run('UPDATE pitches SET zone = ? WHERE id = ?', [parts.join(' / '), p.id]);
            }
            return true;
        } catch { return false; }
    }

    function removeZone(name) {
        run('DELETE FROM zones WHERE name = ?', [name]);
    }

    // Pitches
    function addPitch(player, pitchType, zone, result) {
        const uuid = crypto.randomUUID();
        run(
            'INSERT INTO pitches (player, pitch_type, zone, result, uuid) VALUES (?, ?, ?, ?, ?)',
            [player, pitchType, zone, result, uuid]
        );
        return uuid;
    }

    function removePitch(uuid) {
        run('DELETE FROM pitches WHERE uuid = ?', [uuid]);
    }

    function getLastPitch() {
        return getOne('SELECT * FROM pitches ORDER BY id DESC LIMIT 1');
    }

    function getResults(player = null, dateFrom = null, dateTo = null) {
        let where = [];
        let params = [];

        if (player) {
            where.push('player = ?');
            params.push(player);
        }
        if (dateFrom) {
            where.push('date(created_at) >= ?');
            params.push(dateFrom);
        }
        if (dateTo) {
            where.push('date(created_at) <= ?');
            params.push(dateTo);
        }

        const whereClause = where.length > 0 ? 'WHERE ' + where.join(' AND ') : '';

        return query(`
            SELECT player, pitch_type, zone,
                COUNT(*) as total,
                SUM(CASE WHEN result='Strike' THEN 1 ELSE 0 END) as strikes,
                SUM(CASE WHEN result='Ball' THEN 1 ELSE 0 END) as balls,
                SUM(CASE WHEN result='Foul' THEN 1 ELSE 0 END) as fouls,
                SUM(CASE WHEN result='Hit' THEN 1 ELSE 0 END) as hits
            FROM pitches ${whereClause}
            GROUP BY player, pitch_type, zone
            ORDER BY player, pitch_type, zone
        `, params);
    }

    function getLiveResults(player) {
        if (!player) return [];
        return getResults(player);
    }

    // Setup defaults
    function setupDefaults(sport) {
        const defaultZones = ['Inside', 'Outside', 'High', 'Low', 'Middle', 'Pitch Out'];
        for (const z of defaultZones) addZone(z);

        const pitchTypes = sport === 'baseball'
            ? ['4-Seam FB', '2-Seam FB', 'Sinker', 'Change Up', 'Slider']
            : ['Fastball', 'Changeup', 'Curve', 'Drop', 'Rise'];
        for (const pt of pitchTypes) addPitchType(pt);

        addPlayer('Player 1');
        addPlayer('Player 2');
    }

    // Export (camelCase field names for iOS compatibility)
    function exportAll() {
        const pitches = query('SELECT uuid, player, pitch_type, zone, result, created_at FROM pitches ORDER BY id');
        return {
            version: 1,
            exportDate: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
            players: getPlayers().map(p => p.name),
            pitchTypes: getPitchTypes().map(p => p.name),
            zones: getZones().map(z => z.name),
            pitches: pitches.map(p => ({
                uuid: p.uuid,
                player: p.player,
                pitchType: p.pitch_type,
                zone: p.zone,
                result: p.result,
                createdAt: p.created_at
            }))
        };
    }

    // Import
    function importData(data) {
        if (!data || typeof data !== 'object') throw new Error('Invalid data');
        if (data.pitches && data.pitches.length > 50000) throw new Error('File too large');
        let count = 0;
        if (data.players && Array.isArray(data.players)) {
            for (const p of data.players) addPlayer(p);
        }
        if (data.pitchTypes) {
            for (const pt of data.pitchTypes) addPitchType(pt);
        }
        if (data.zones) {
            for (const z of data.zones) addZone(z);
        }
        if (data.pitches) {
            for (const p of data.pitches) {
                const existing = getOne('SELECT id FROM pitches WHERE uuid = ?', [p.uuid]);
                if (!existing) {
                    const uuid = p.uuid || crypto.randomUUID();
                    run(
                        'INSERT INTO pitches (player, pitch_type, zone, result, created_at, uuid) VALUES (?, ?, ?, ?, ?, ?)',
                        [p.player, p.pitch_type || p.pitchType, p.zone, p.result, p.created_at || p.createdAt, uuid]
                    );
                    count++;
                }
            }
        }
        return count;
    }

    function resetAll() {
        run('DELETE FROM pitches');
        run('DELETE FROM players');
        run('DELETE FROM pitch_types');
        run('DELETE FROM zones');
        localStorage.removeItem('pitchstatpro_onboarded');
    }

    function hasData() {
        const result = getOne('SELECT COUNT(*) as c FROM players');
        return result && result.c > 0;
    }

    function setSaveErrorCallback(fn) { _onSaveError = fn; }

    return {
        init, setSaveErrorCallback, getPlayers, addPlayer, renamePlayer, removePlayer,
        getPitchTypes, addPitchType, renamePitchType, removePitchType,
        getZones, addZone, renameZone, removeZone,
        addPitch, removePitch, getLastPitch, getResults, getLiveResults,
        setupDefaults, exportAll, importData, resetAll, hasData
    };
})();

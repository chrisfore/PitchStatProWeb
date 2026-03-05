// Pitch Stat Pro - Web App
(async () => {
    await DB.init();
    DB.setSaveErrorCallback(() => showToast('Storage full! Export your data to avoid loss.'));

    // State
    let selectedPlayer = null;
    let selectedPitchType = null;
    let selectedZones = new Set();
    let selectedResult = null;
    let lastPitchUuid = null;

    // DOM refs
    const onboarding = document.getElementById('onboarding');
    const mainApp = document.getElementById('main-app');
    const playerSelect = document.getElementById('player-select');
    const pitchTypeSelect = document.getElementById('pitch-type-select');
    const zoneSelect = document.getElementById('zone-select');
    const resultSelect = document.getElementById('result-select');
    const submitBtn = document.getElementById('submit-pitch');
    const undoBtn = document.getElementById('undo-pitch');
    const liveResultsList = document.getElementById('live-results-list');
    const resultsPlayerFilter = document.getElementById('results-player-filter');
    const dateFilterToggle = document.getElementById('date-filter-toggle');
    const dateRangeRow = document.getElementById('date-range-row');
    const dateFrom = document.getElementById('date-from');
    const dateTo = document.getElementById('date-to');
    const resultsList = document.getElementById('results-list');
    const darkModeToggle = document.getElementById('dark-mode-toggle');
    const toast = document.getElementById('toast');

    // Init
    if (localStorage.getItem('pitchstatpro_dark') === 'true') {
        document.documentElement.setAttribute('data-theme', 'dark');
        darkModeToggle.checked = true;
    }

    if (localStorage.getItem('pitchstatpro_onboarded') && DB.hasData()) {
        showMain();
    } else {
        onboarding.style.display = 'block';
    }

    // Onboarding
    document.querySelectorAll('.sport-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            DB.setupDefaults(btn.dataset.sport);
            localStorage.setItem('pitchstatpro_onboarded', 'true');
            showMain();
        });
    });

    function showMain() {
        onboarding.style.display = 'none';
        mainApp.style.display = 'block';
        refreshAll();
    }

    // Tabs
    document.querySelectorAll('.tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            tab.classList.add('active');
            document.getElementById(tab.dataset.tab + '-tab').classList.add('active');
            if (tab.dataset.tab === 'results') refreshResults();
            if (tab.dataset.tab === 'settings') refreshSettings();
        });
    });

    // Dark mode
    darkModeToggle.addEventListener('change', () => {
        if (darkModeToggle.checked) {
            document.documentElement.setAttribute('data-theme', 'dark');
            localStorage.setItem('pitchstatpro_dark', 'true');
        } else {
            document.documentElement.removeAttribute('data-theme');
            localStorage.setItem('pitchstatpro_dark', 'false');
        }
    });

    // --- TRACK TAB ---
    function refreshTrack() {
        renderSelectionGrid(playerSelect, DB.getPlayers().map(p => p.name), selectedPlayer, name => {
            selectedPlayer = selectedPlayer === name ? null : name;
            refreshTrack();
            refreshLiveResults();
        });

        renderSelectionGrid(pitchTypeSelect, DB.getPitchTypes().map(p => p.name), selectedPitchType, name => {
            selectedPitchType = selectedPitchType === name ? null : name;
            refreshTrack();
        });

        renderMultiSelectGrid(zoneSelect, DB.getZones().map(z => z.name), selectedZones, 2, name => {
            if (selectedZones.has(name)) {
                selectedZones.delete(name);
            } else if (selectedZones.size < 2) {
                selectedZones.add(name);
            }
            refreshTrack();
        });

        // Result buttons
        resultSelect.querySelectorAll('.sel-btn').forEach(btn => {
            btn.classList.toggle('selected', btn.dataset.value === selectedResult);
            btn.onclick = () => {
                selectedResult = selectedResult === btn.dataset.value ? null : btn.dataset.value;
                refreshTrack();
            };
        });

        submitBtn.disabled = !(selectedPlayer && selectedPitchType && selectedZones.size > 0 && selectedResult);
    }

    function renderSelectionGrid(container, items, selected, onClick) {
        container.innerHTML = '';
        for (const name of items) {
            const btn = document.createElement('button');
            btn.className = 'sel-btn' + (name === selected ? ' selected' : '');
            btn.textContent = name;
            btn.addEventListener('click', () => onClick(name));
            container.appendChild(btn);
        }
    }

    function renderMultiSelectGrid(container, items, selectedSet, max, onClick) {
        container.innerHTML = '';
        for (const name of items) {
            const btn = document.createElement('button');
            btn.className = 'sel-btn' + (selectedSet.has(name) ? ' selected' : '');
            btn.textContent = name;
            btn.addEventListener('click', () => onClick(name));
            container.appendChild(btn);
        }
    }

    submitBtn.addEventListener('click', () => {
        if (!selectedPlayer || !selectedPitchType || selectedZones.size === 0 || !selectedResult) return;
        const zone = Array.from(selectedZones).sort().join(' / ');
        const uuid = DB.addPitch(selectedPlayer, selectedPitchType, zone, selectedResult);
        lastPitchUuid = uuid;
        undoBtn.style.display = 'block';

        // Reset selections except player
        selectedPitchType = null;
        selectedZones.clear();
        selectedResult = null;
        refreshTrack();
        refreshLiveResults();
        showToast('Pitch recorded');
    });

    undoBtn.addEventListener('click', () => {
        if (lastPitchUuid) {
            DB.removePitch(lastPitchUuid);
            lastPitchUuid = null;
            undoBtn.style.display = 'none';
            refreshTrack();
            refreshLiveResults();
            showToast('Pitch undone');
        }
    });

    function refreshLiveResults() {
        if (!selectedPlayer) {
            liveResultsList.innerHTML = '<div class="empty-state"><p>Select a player to see live results</p></div>';
            return;
        }
        const results = DB.getLiveResults(selectedPlayer);
        if (results.length === 0) {
            liveResultsList.innerHTML = '<div class="empty-state"><p>No pitches recorded yet</p></div>';
            return;
        }
        liveResultsList.innerHTML = results.map(r => {
            const winPct = r.total > 0 ? ((r.strikes + r.fouls) / r.total * 100) : 0;
            const hitPct = r.total > 0 ? (r.hits / r.total * 100) : 0;
            const perfClass = winPct >= 65 ? 'perf-green' : winPct >= 48 ? 'perf-yellow' : 'perf-red';
            return `<div class="live-result-row ${perfClass}">
                <div class="label">${escapeHtml(r.pitch_type)} - ${escapeHtml(r.zone)}</div>
                <div class="stat"><div class="stat-value">${winPct.toFixed(0)}%</div><div class="stat-label">Win</div></div>
                <div class="stat"><div class="stat-value">${hitPct.toFixed(0)}%</div><div class="stat-label">Hit</div></div>
                <div class="stat"><div class="stat-value">${r.total}</div><div class="stat-label">Total</div></div>
            </div>`;
        }).join('');
    }

    // --- RESULTS TAB ---
    dateFilterToggle.addEventListener('change', () => {
        dateRangeRow.style.display = dateFilterToggle.checked ? 'flex' : 'none';
        refreshResults();
    });

    dateFrom.addEventListener('change', refreshResults);
    dateTo.addEventListener('change', refreshResults);
    resultsPlayerFilter.addEventListener('change', refreshResults);

    function refreshResults() {
        // Update player filter options
        const players = DB.getPlayers().map(p => p.name);
        const currentVal = resultsPlayerFilter.value;
        resultsPlayerFilter.innerHTML = '<option value="">All Players</option>' +
            players.map(p => `<option value="${escapeHtml(p)}">${escapeHtml(p)}</option>`).join('');
        resultsPlayerFilter.value = currentVal;

        const player = resultsPlayerFilter.value || null;
        const from = dateFilterToggle.checked && dateFrom.value ? dateFrom.value : null;
        const to = dateFilterToggle.checked && dateTo.value ? dateTo.value : null;
        const results = DB.getResults(player, from, to);

        if (results.length === 0) {
            resultsList.innerHTML = '<div class="empty-state"><p>No results to display</p></div>';
            return;
        }

        let html = `<div class="result-row header">
            <div>Player</div>
            <div>Pitch</div>
            <div>Zone</div>
            <div class="stat-cell">Total</div>
            <div class="stat-cell">Strike%</div>
            <div class="stat-cell">Ball%</div>
            <div class="stat-cell hide-mobile">Foul%</div>
            <div class="stat-cell hide-mobile">Hit%</div>
            <div class="stat-cell">Win%</div>
        </div>`;

        for (const r of results) {
            const strikePct = (r.strikes / r.total * 100).toFixed(0);
            const ballPct = (r.balls / r.total * 100).toFixed(0);
            const foulPct = (r.fouls / r.total * 100).toFixed(0);
            const hitPct = (r.hits / r.total * 100).toFixed(0);
            const winPct = ((r.strikes + r.fouls) / r.total * 100).toFixed(0);
            const perfClass = winPct >= 65 ? 'perf-green' : winPct >= 48 ? 'perf-yellow' : 'perf-red';

            html += `<div class="result-row ${perfClass}">
                <div>${escapeHtml(r.player)}</div>
                <div>${escapeHtml(r.pitch_type)}</div>
                <div>${escapeHtml(r.zone)}</div>
                <div class="stat-cell">${r.total}</div>
                <div class="stat-cell">${strikePct}%</div>
                <div class="stat-cell">${ballPct}%</div>
                <div class="stat-cell hide-mobile">${foulPct}%</div>
                <div class="stat-cell hide-mobile">${hitPct}%</div>
                <div class="stat-cell">${winPct}%</div>
            </div>`;
        }
        resultsList.innerHTML = html;
    }

    // PDF Export
    document.getElementById('export-pdf').addEventListener('click', () => {
        const player = resultsPlayerFilter.value || null;
        const from = dateFilterToggle.checked && dateFrom.value ? dateFrom.value : null;
        const to = dateFilterToggle.checked && dateTo.value ? dateTo.value : null;
        const results = DB.getResults(player, from, to);

        if (results.length === 0) {
            showToast('No data to export');
            return;
        }

        generatePDF(results, player, from, to);
    });

    function generatePDF(results, player, from, to) {
        const title = player ? `${player} - Pitch Report` : 'All Players - Pitch Report';
        const dateRange = from || to ? `${from || 'Start'} to ${to || 'Now'}` : 'All Time';

        // Build HTML table for print
        let tableHTML = `
            <html><head><style>
                body { font-family: -apple-system, sans-serif; padding: 20px; color: #1d1d1f; }
                h1 { font-size: 18px; margin-bottom: 4px; }
                .subtitle { color: #6e6e73; font-size: 12px; margin-bottom: 16px; }
                table { width: 100%; border-collapse: collapse; font-size: 11px; }
                th { background: #f5f5f7; text-align: left; padding: 8px 6px; font-weight: 600;
                     text-transform: uppercase; font-size: 10px; letter-spacing: 0.5px; border-bottom: 2px solid #d2d2d7; }
                td { padding: 6px; border-bottom: 1px solid #e5e5ea; }
                tr.green { background: #d4edda; }
                tr.yellow { background: #fff3cd; }
                tr.red { background: #f8d7da; }
                .right { text-align: right; }
            </style></head><body>
            <h1>${escapeHtml(title)}</h1>
            <div class="subtitle">${escapeHtml(dateRange)} | Generated ${new Date().toLocaleDateString()}</div>
            <table>
                <tr><th>Player</th><th>Pitch</th><th>Zone</th><th class="right">Total</th>
                    <th class="right">Strike%</th><th class="right">Ball%</th>
                    <th class="right">Foul%</th><th class="right">Hit%</th><th class="right">Win%</th></tr>`;

        for (const r of results) {
            const winPct = ((r.strikes + r.fouls) / r.total * 100);
            const cls = winPct >= 65 ? 'green' : winPct >= 48 ? 'yellow' : 'red';
            tableHTML += `<tr class="${cls}">
                <td>${escapeHtml(r.player)}</td><td>${escapeHtml(r.pitch_type)}</td><td>${escapeHtml(r.zone)}</td>
                <td class="right">${r.total}</td>
                <td class="right">${(r.strikes/r.total*100).toFixed(0)}%</td>
                <td class="right">${(r.balls/r.total*100).toFixed(0)}%</td>
                <td class="right">${(r.fouls/r.total*100).toFixed(0)}%</td>
                <td class="right">${(r.hits/r.total*100).toFixed(0)}%</td>
                <td class="right">${winPct.toFixed(0)}%</td>
            </tr>`;
        }
        tableHTML += '</table></body></html>';

        const printWindow = window.open('', '_blank');
        if (!printWindow) { showToast('Pop-up blocked — please allow pop-ups'); return; }
        printWindow.document.write(tableHTML);
        printWindow.document.close();
        printWindow.focus();
        printWindow.onafterprint = () => printWindow.close();
        printWindow.print();
    }

    // --- SETTINGS TAB ---
    function refreshSettings() {
        renderSettingsList('settings-players', DB.getPlayers().map(p => p.name), 'player');
        renderSettingsList('settings-pitch-types', DB.getPitchTypes().map(p => p.name), 'pitchType');
        renderSettingsList('settings-zones', DB.getZones().map(z => z.name), 'zone');
    }

    function renderSettingsList(containerId, items, type) {
        const container = document.getElementById(containerId);
        if (items.length === 0) {
            container.innerHTML = '<div class="empty-state"><p>None added yet</p></div>';
            return;
        }
        container.innerHTML = items.map(name => `
            <div class="settings-item">
                <span>${escapeHtml(name)}</span>
                <div class="settings-item-actions">
                    <button class="icon-btn" data-action="rename" data-type="${type}" data-name="${escapeAttr(name)}">Rename</button>
                    <button class="icon-btn danger" data-action="remove" data-type="${type}" data-name="${escapeAttr(name)}">Remove</button>
                </div>
            </div>
        `).join('');

        container.querySelectorAll('[data-action="rename"]').forEach(btn => {
            btn.addEventListener('click', () => showRename(btn.dataset.type, btn.dataset.name));
        });
        container.querySelectorAll('[data-action="remove"]').forEach(btn => {
            btn.addEventListener('click', () => {
                showConfirm(`Remove "${btn.dataset.name}"?`, () => {
                    if (btn.dataset.type === 'player') DB.removePlayer(btn.dataset.name);
                    else if (btn.dataset.type === 'pitchType') DB.removePitchType(btn.dataset.name);
                    else if (btn.dataset.type === 'zone') DB.removeZone(btn.dataset.name);
                    refreshSettings();
                    refreshTrack();
                    showToast('Removed');
                });
            });
        });
    }

    // Add buttons
    document.getElementById('add-player').addEventListener('click', () => {
        const input = document.getElementById('new-player-name');
        if (DB.addPlayer(input.value)) {
            input.value = '';
            refreshSettings();
            refreshTrack();
            showToast('Player added');
        } else {
            showToast('Player already exists or invalid');
        }
    });

    document.getElementById('add-pitch-type').addEventListener('click', () => {
        const input = document.getElementById('new-pitch-type');
        if (DB.addPitchType(input.value)) {
            input.value = '';
            refreshSettings();
            refreshTrack();
            showToast('Pitch type added');
        } else {
            showToast('Already exists or invalid');
        }
    });

    document.getElementById('add-zone').addEventListener('click', () => {
        const input = document.getElementById('new-zone');
        if (DB.addZone(input.value)) {
            input.value = '';
            refreshSettings();
            refreshTrack();
            showToast('Zone added');
        } else {
            showToast('Already exists or invalid');
        }
    });

    // Enter key support for add inputs
    ['new-player-name', 'new-pitch-type', 'new-zone'].forEach(id => {
        document.getElementById(id).addEventListener('keydown', e => {
            if (e.key === 'Enter') {
                e.target.closest('.add-row').querySelector('.action-btn').click();
            }
        });
    });

    // Export/Import
    function downloadData(data, filename) {
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
        showToast('Data exported');
    }

    function showExportSelectModal(options, onSelect) {
        const modal = document.getElementById('export-select-modal');
        const dropdown = document.getElementById('export-select-dropdown');
        dropdown.innerHTML = options.map(o => `<option value="${escapeAttr(o.value)}">${escapeHtml(o.label)}</option>`).join('');
        modal.style.display = 'flex';

        const okBtn = document.getElementById('export-select-ok');
        const cancelBtn = document.getElementById('export-select-cancel');
        const ac = new AbortController();

        const cleanup = () => {
            modal.style.display = 'none';
            ac.abort();
            okBtn.replaceWith(okBtn.cloneNode(true));
            cancelBtn.replaceWith(cancelBtn.cloneNode(true));
        };

        document.getElementById('export-select-ok').addEventListener('click', () => {
            const val = dropdown.value;
            cleanup();
            if (val) onSelect(val);
        });
        document.getElementById('export-select-cancel').addEventListener('click', cleanup);
        document.addEventListener('keydown', e => { if (e.key === 'Escape') cleanup(); }, { signal: ac.signal });
    }

    document.getElementById('export-player').addEventListener('click', () => {
        const players = DB.getPlayers().map(p => p.name);
        if (players.length === 0) { showToast('No players to export'); return; }
        const options = players.map(name => ({ value: name, label: name }));
        showExportSelectModal(options, (playerName) => {
            const data = DB.exportPlayer(playerName);
            const safeName = playerName.replace(/\s+/g, '_');
            downloadData(data, `PitchStatPro_${safeName}_${new Date().toISOString().slice(0,10)}.pitchdata`);
        });
    });

    document.getElementById('export-data').addEventListener('click', () => {
        const data = DB.exportAll();
        downloadData(data, `PitchStatPro_${new Date().toISOString().slice(0,10)}.pitchdata`);
    });

    document.getElementById('import-data').addEventListener('click', () => {
        document.getElementById('import-file').click();
    });

    document.getElementById('import-file').addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        if (file.size > 10 * 1024 * 1024) { showToast('File too large (10MB max)'); e.target.value = ''; return; }
        try {
            const text = await file.text();
            const data = JSON.parse(text);
            const count = DB.importData(data);
            refreshAll();
            showToast(`Imported ${count} pitches`);
        } catch (err) {
            showToast('Import failed: invalid file');
        }
        e.target.value = '';
    });

    document.getElementById('reset-all').addEventListener('click', () => {
        showConfirm('Reset ALL data? This cannot be undone.', () => {
            DB.resetAll();
            selectedPlayer = null;
            selectedPitchType = null;
            selectedZones.clear();
            selectedResult = null;
            lastPitchUuid = null;
            mainApp.style.display = 'none';
            onboarding.style.display = 'block';
            showToast('All data reset');
        });
    });

    // --- Modals ---
    function showConfirm(message, onConfirm) {
        const modal = document.getElementById('confirm-modal');
        document.getElementById('confirm-message').textContent = message;
        modal.style.display = 'flex';

        const okBtn = document.getElementById('confirm-ok');
        const cancelBtn = document.getElementById('confirm-cancel');
        const ac = new AbortController();

        const cleanup = () => {
            modal.style.display = 'none';
            ac.abort();
            okBtn.replaceWith(okBtn.cloneNode(true));
            cancelBtn.replaceWith(cancelBtn.cloneNode(true));
        };

        document.getElementById('confirm-ok').addEventListener('click', () => { cleanup(); onConfirm(); });
        document.getElementById('confirm-cancel').addEventListener('click', cleanup);
        document.addEventListener('keydown', e => { if (e.key === 'Escape') cleanup(); }, { signal: ac.signal });
    }

    function showRename(type, oldName) {
        const modal = document.getElementById('rename-modal');
        const input = document.getElementById('rename-input');
        document.getElementById('rename-title').textContent = `Rename "${oldName}"`;
        input.value = oldName;
        modal.style.display = 'flex';
        input.focus();
        input.select();

        const okBtn = document.getElementById('rename-ok');
        const cancelBtn = document.getElementById('rename-cancel');
        const ac = new AbortController();

        const cleanup = () => {
            modal.style.display = 'none';
            ac.abort();
            okBtn.replaceWith(okBtn.cloneNode(true));
            cancelBtn.replaceWith(cancelBtn.cloneNode(true));
        };

        document.getElementById('rename-ok').addEventListener('click', () => {
            const newName = input.value.trim();
            if (!newName || newName === oldName) { cleanup(); return; }
            let success = false;
            if (type === 'player') success = DB.renamePlayer(oldName, newName);
            else if (type === 'pitchType') success = DB.renamePitchType(oldName, newName);
            else if (type === 'zone') success = DB.renameZone(oldName, newName);
            cleanup();
            if (success) {
                if (type === 'player' && selectedPlayer === oldName) selectedPlayer = newName;
                refreshSettings();
                refreshTrack();
                showToast('Renamed');
            } else {
                showToast('Name already taken');
            }
        });

        document.getElementById('rename-cancel').addEventListener('click', cleanup);
        input.addEventListener('keydown', e => {
            if (e.key === 'Enter') document.getElementById('rename-ok').click();
            if (e.key === 'Escape') cleanup();
        }, { signal: ac.signal });
    }

    // --- Utilities ---
    function refreshAll() {
        refreshTrack();
        refreshLiveResults();
        refreshResults();
        refreshSettings();
    }

    function showToast(msg) {
        toast.textContent = msg;
        toast.classList.add('show');
        setTimeout(() => toast.classList.remove('show'), 2000);
    }

    function escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    function escapeAttr(str) {
        return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }
})();

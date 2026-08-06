'use client';

import { useEffect, useState } from 'react';
import {
    countPlayerLevels,
    getLevelClasses,
    getLevelLabel,
} from '../../utils/playerLevel';

export default function RegisteredPlayers({
    selectedPlayers,
    setSelectedPlayers,
    category
}) {
    const [players, setPlayers] = useState([]);
    const [search, setSearch] = useState('');

    const updatePlayerSelection = (player, shouldSelect) => {
        const selectedPlayer = {
            id: player.id,
            name: player.name,
            gender: player.gender,
            level: player.level,
        };

        if (shouldSelect) {
            setSelectedPlayers((prev) => {
                const alreadySelected = prev.some(
                    (selected) => selected.id === player.id
                );

                if (alreadySelected) {
                    return prev;
                }

                return [...prev, selectedPlayer];
            });
        } else {
            setSelectedPlayers((prev) =>
                prev.filter(
                    (selected) => selected.id !== player.id
                )
            );
        }
    };

    const handlePlayerRowClick = (event, player, isSelected) => {
        if (event.target.closest?.("button, input, select, textarea, a, [role='button']")) return;
        updatePlayerSelection(player, !isSelected);
    };

    const filteredPlayers = players.filter((player) => {
        const matchesSearch = player.name.toLowerCase().includes(search.trim().toLowerCase());

        if(category === 'mens'){
            return matchesSearch && player.gender === 'male';
        }else if (category === 'womens'){
            return matchesSearch && player.gender === 'female';
        }

        return matchesSearch;
    });


    const allSelected =
        filteredPlayers.length > 0 &&
        filteredPlayers.every((player) =>
            selectedPlayers.some(
                (selected) => selected.id === player.id
            )
        );

    const handleSelectAll = (e) => {
        if (e.target.checked) {
            setSelectedPlayers((prev) => {
                const updatedPlayers = [...prev];

                filteredPlayers.forEach((player) => {
                    const alreadySelected = updatedPlayers.some(
                        (selected) => selected.id === player.id
                    );

                    if (!alreadySelected) {
                        updatedPlayers.push({
                            id: player.id,
                            name: player.name,
                            gender: player.gender,
                            level: player.level,
                        });
                    }
                });

                return updatedPlayers;
            });
        } else {
            setSelectedPlayers((prev) =>
                prev.filter(
                    (selected) =>
                        !filteredPlayers.some(
                            (player) =>
                                player.id === selected.id
                        )
                )
            );
        }
    };

    const selectedLevelCounts = countPlayerLevels(selectedPlayers);

    const levelCards = [
        { key: 'beginner', label: 'Beginner' },
        { key: 'intermediate', label: 'Intermediate' },
        { key: 'upper_intermediate', label: 'Upper Intermediate' },
        { key: 'advanced', label: 'Advanced' },
    ];

    useEffect(() => {
        let isCancelled = false;

        window.api.getRegisteredPlayersToday()
            .then((registeredPlayers) => {
                if (isCancelled) return;

                setPlayers(Array.isArray(registeredPlayers) ? registeredPlayers : []);
            })
            .catch((error) => {
                if (!isCancelled) {
                    console.error('Failed to load tournament players:', error);
                    setPlayers([]);
                }
            });

        return () => {
            isCancelled = true;
        };
    }, []);

    return (
        <div className="xl:col-span-2 bg-[var(--surface)] rounded-2xl border border-[var(--border)] overflow-hidden max-h-[600px]">

            <div className="p-4 border-b border-[var(--border)]">

                <div className="flex justify-between items-center mb-4">

                    <div>
                        <h2 className="font-semibold text-[var(--text-h)]">
                            Registered Players Today
                        </h2>

                        <p className="text-sm text-[var(--text)]">
                            Select players that will participate.
                        </p>
                    </div>

                    <span className="text-sm">
                        Selected:{' '}
                        <strong>{selectedPlayers.length}</strong>
                    </span>

                </div>

                <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text)] mb-3">
                    Selected Players by Level
                </p>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                    {levelCards.map((level) => (
                        <div
                            key={level.key}
                            className={`rounded-xl border p-3 text-center ${getLevelClasses(level.key)}`}
                        >
                            <p className="text-xl font-bold">
                                {selectedLevelCounts[level.key]}
                            </p>
                            <p className="text-xs">
                                {level.label}
                            </p>
                        </div>
                    ))}
                </div>

                <div className="flex gap-3">

                    <input
                        type="text"
                        placeholder="Search player..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="flex-1 rounded-xl border border-[var(--border)] px-4 py-2 outline-none"
                    />

                    <label className="flex items-center gap-2 whitespace-nowrap text-sm">
                        <input
                            type="checkbox"
                            checked={allSelected}
                            onChange={handleSelectAll}
                        />

                        Select All
                    </label>

                </div>

            </div>

            <div className="max-h-[360px] overflow-y-auto divide-y divide-[var(--border)]">

                {filteredPlayers.map((player) => {
                    const isSelected = selectedPlayers.some(
                        (selected) => selected.id === player.id
                    );

                    return (
                        <div
                            key={player.id}
                            onClick={(event) => handlePlayerRowClick(event, player, isSelected)}
                            className={`flex cursor-pointer items-center justify-between border-l-4 p-4 transition-colors duration-150 ${isSelected ? 'border-l-[var(--primary)] bg-[var(--primary-light)]/70' : 'border-l-transparent hover:bg-[var(--surface-hover)]/70'}`}
                        >

                            <div className="flex items-center gap-3">

                                <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onClick={(event) => event.stopPropagation()}
                                    onChange={(event) => updatePlayerSelection(player, event.target.checked)}
                                    aria-label={`Select ${player.name}`}
                                />

                                <div>

                                    <p className={`font-medium inline-flex rounded-full border px-3 py-1 ${getLevelClasses(player.level)}`}>
                                        {player.name.toUpperCase()}
                                    </p>

                                    <p className="text-sm text-[var(--text)]">
                                        {player.gender
                                            ? player.gender
                                                  .charAt(0)
                                                  .toUpperCase() +
                                              player.gender
                                                  .slice(1)
                                                  .toLowerCase()
                                            : 'Unknown'}

                                        &nbsp; &bull; &nbsp;

                                        {getLevelLabel(player.level)}
                                    </p>

                                </div>

                            </div>

                        </div>
                    );
                })}

            </div>

        </div>
    );
}

import { useGameStore, SHIPS } from '../store/gameStore';

export default function PlacementUI() {
  const currentShipIndex = useGameStore((s) => s.currentShipIndex);
  const orientation = useGameStore((s) => s.orientation);
  const toggleOrientation = useGameStore((s) => s.toggleOrientation);
  const resetPlacement = useGameStore((s) => s.resetPlacement);
  const placedShips = useGameStore((s) => s.placedShips);
  const confirmFleet = useGameStore((s) => s.confirmFleet);

  const allPlaced = currentShipIndex >= SHIPS.length;

  return (
    <div className="w-[260px] p-6 bg-black/40 flex flex-col gap-4 shrink-0">
      <h3 className="m-0 text-cyan-400 text-lg tracking-wide">Place Your Fleet</h3>

      <div className="flex flex-col gap-2">
        {SHIPS.map((ship, i) => (
          <div
            key={ship.name}
            className={`flex justify-between items-center px-3 py-2 rounded-md text-sm transition-all
              ${i === currentShipIndex ? 'bg-cyan-400/15 text-cyan-400 border border-cyan-400/30' : ''}
              ${i < currentShipIndex ? 'text-emerald-400 bg-white/[0.03]' : ''}
              ${i > currentShipIndex ? 'text-gray-500 bg-white/[0.03]' : ''}
            `}
          >
            <span className="font-medium">{ship.name}</span>
            <span className="tracking-widest text-xs">{'■'.repeat(ship.length)}</span>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-2">
        <button
          className="px-4 py-2.5 text-sm bg-white/5 border border-gray-600 text-gray-300 rounded-md cursor-pointer transition-all hover:border-cyan-400 hover:text-cyan-400 disabled:opacity-40 disabled:cursor-not-allowed"
          onClick={toggleOrientation}
          disabled={allPlaced}
        >
          Rotate ({orientation === 'horizontal' ? 'H' : 'V'})
        </button>
        <button
          className="px-4 py-2.5 text-sm bg-white/5 border border-gray-600 text-gray-300 rounded-md cursor-pointer transition-all hover:border-cyan-400 hover:text-cyan-400 disabled:opacity-40 disabled:cursor-not-allowed"
          onClick={resetPlacement}
          disabled={placedShips.length === 0}
        >
          Reset
        </button>
        {allPlaced && (
          <button
            className="px-4 py-2.5 text-sm bg-emerald-500/15 border border-emerald-500 text-emerald-400 rounded-md cursor-pointer transition-all hover:bg-emerald-500/30"
            onClick={confirmFleet}
          >
            Confirm Fleet
          </button>
        )}
      </div>

      {!allPlaced && (
        <p className="text-gray-500 text-sm m-0">
          Click on the board to place {SHIPS[currentShipIndex].name} ({SHIPS[currentShipIndex].length} cells)
        </p>
      )}
    </div>
  );
}

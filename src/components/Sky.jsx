import { SCENE } from '../scene/sceneLayout.js';

/** The sky behind the window glass. Its colours come from the time-of-day class on the room stage. */
export function Sky() {
  const { x, y, w, h, horizon, polygon, skyline, lights } = SCENE.sky;
  return (
    <div
      className="sky"
      style={{ left: x, top: y, width: w, height: h, clipPath: `polygon(${polygon.map(([px, py]) => `${px}px ${py}px`).join(',')})` }}
    >
      <div className="sky__bands" style={{ height: horizon }}>
        <span />
        <span />
        <span />
        <span />
        <span />
      </div>
      <div className="sky__ground" style={{ top: horizon }} />
      <div className="sky__stars" />
      <div className="sky__sun" />
      <img className="sky__city" src={skyline} alt="" />
      <img className="sky__lights" src={lights} alt="" />
    </div>
  );
}

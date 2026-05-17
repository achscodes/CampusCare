import {
  DOFeaturePreview,
  DocumentRequestFeaturePreview,
  HSOFeaturePreview,
  ReferralFeaturePreview,
  SDAOFeaturePreview,
} from "./AuthFeaturePreviews";
import "./AuthAsideCarousel.css";

/**
 * Infinite horizontal marquee — DO, HSO, SDAO dashboards + Referrals + Document requests.
 * Pure CSS animation; no controls; does not pause.
 */
const SLIDE_SET = [
  { key: "do", node: <DOFeaturePreview /> },
  { key: "hso", node: <HSOFeaturePreview /> },
  { key: "sdao", node: <SDAOFeaturePreview /> },
  { key: "referral", node: <ReferralFeaturePreview /> },
  { key: "docreq", node: <DocumentRequestFeaturePreview /> },
];

export default function AuthAsideCarousel() {
  return (
    <div className="auth-aside-carousel" aria-hidden>
      <div className="auth-aside-carousel__track">
        <div className="auth-aside-carousel__chunk">
          {SLIDE_SET.map(({ key, node }) => (
            <div key={key} className="auth-aside-carousel__slide">
              {node}
            </div>
          ))}
        </div>
        <div className="auth-aside-carousel__chunk" aria-hidden>
          {SLIDE_SET.map(({ key, node }) => (
            <div key={`${key}-dup`} className="auth-aside-carousel__slide">
              {node}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

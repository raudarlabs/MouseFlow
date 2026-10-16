/* The landing's client entry. The page arrives already rendered (scripts/build-landing.mjs puts the
 * server's markup into #root), so this HYDRATES it - attaches the form's handlers to the HTML that is
 * already there - rather than drawing it again. In `npm run dev:landing` there is no prerender and #root
 * is empty, so it renders from scratch instead; hydrating an empty root would only log a mismatch. */
import { StrictMode } from 'react';
import { createRoot, hydrateRoot } from 'react-dom/client';
import './landing.css';
import { Landing } from './Landing';
import { WAITLIST_ENDPOINT } from './endpoint';

const root = document.getElementById('root')!;
const app = (
  <StrictMode>
    <Landing endpoint={WAITLIST_ENDPOINT} />
  </StrictMode>
);

if (root.firstElementChild) hydrateRoot(root, app);
else createRoot(root).render(app);

// RequireSession — route guard. No session for this role → that role's sign-in page.
// The page we came from (incl. ?tab=verify) is passed on, so sign-in returns there.
import { Navigate, useLocation } from 'react-router-dom'
import { getSession, LOGIN_PATH } from '../session'

export default function RequireSession({ role, children }) {
  const location = useLocation()
  if (getSession()?.role !== role) {
    return <Navigate to={LOGIN_PATH[role]} replace state={{ from: location.pathname + location.search }} />
  }
  return children
}

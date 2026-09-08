import { Outlet } from "react-router-dom"
import NavBar from "../components/NavBar"

export default function PublicLayout() {
  return (
    <>
      <NavBar />
      <Outlet />
    </>
  )
}

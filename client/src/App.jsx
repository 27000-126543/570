import React, { useState, useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import Login from './pages/Login.jsx'
import MainLayout from './components/MainLayout.jsx'
import Dashboard from './pages/Dashboard.jsx'
import CourseList from './pages/courses/CourseList.jsx'
import CourseDetail from './pages/courses/CourseDetail.jsx'
import CourseForm from './pages/courses/CourseForm.jsx'
import QuestionBank from './pages/courses/QuestionBank.jsx'
import MyCourses from './pages/employee/MyCourses.jsx'
import Enrollments from './pages/enrollments/EnrollmentList.jsx'
import PendingApprovals from './pages/enrollments/PendingApprovals.jsx'
import ExamList from './pages/exams/ExamList.jsx'
import ExamForm from './pages/exams/ExamForm.jsx'
import TakeExam from './pages/exams/TakeExam.jsx'
import MyExams from './pages/employee/MyExams.jsx'
import CertificateList from './pages/certificates/CertificateList.jsx'
import MyCertificates from './pages/employee/MyCertificates.jsx'
import ReportList from './pages/reports/ReportList.jsx'
import ReportSummary from './pages/reports/ReportSummary.jsx'
import MySkillProfile from './pages/employee/MySkillProfile.jsx'
import SkillProfileView from './pages/skill/SkillProfileView.jsx'
import UserList from './pages/users/UserList.jsx'
import NotificationList from './pages/notifications/NotificationList.jsx'
import OperationLogs from './pages/logs/OperationLogs.jsx'

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(!!localStorage.getItem('token'))

  useEffect(() => {
    const checkAuth = () => setIsAuthenticated(!!localStorage.getItem('token'))
    window.addEventListener('storage', checkAuth)
    return () => window.removeEventListener('storage', checkAuth)
  }, [])

  return (
    <Routes>
      <Route path="/login" element={<Login onLogin={() => setIsAuthenticated(true)} />} />
      {isAuthenticated ? (
        <Route path="/" element={<MainLayout onLogout={() => setIsAuthenticated(false)} />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="courses" element={<CourseList />} />
          <Route path="courses/new" element={<CourseForm />} />
          <Route path="courses/:id" element={<CourseDetail />} />
          <Route path="courses/:id/edit" element={<CourseForm />} />
          <Route path="courses/:id/questions" element={<QuestionBank />} />
          <Route path="my-courses" element={<MyCourses />} />
          <Route path="my-exams" element={<MyExams />} />
          <Route path="my-certificates" element={<MyCertificates />} />
          <Route path="my-skill-profile" element={<MySkillProfile />} />
          <Route path="enrollments" element={<Enrollments />} />
          <Route path="approvals" element={<PendingApprovals />} />
          <Route path="exams" element={<ExamList />} />
          <Route path="exams/new" element={<ExamForm />} />
          <Route path="exams/:id/edit" element={<ExamForm />} />
          <Route path="exams/:id/take" element={<TakeExam />} />
          <Route path="certificates" element={<CertificateList />} />
          <Route path="reports" element={<ReportList />} />
          <Route path="reports/summary" element={<ReportSummary />} />
          <Route path="users" element={<UserList />} />
          <Route path="users/:id/profile" element={<SkillProfileView />} />
          <Route path="notifications" element={<NotificationList />} />
          <Route path="logs" element={<OperationLogs />} />
        </Route>
      ) : (
        <Route path="*" element={<Navigate to="/login" replace />} />
      )}
    </Routes>
  )
}

export default App

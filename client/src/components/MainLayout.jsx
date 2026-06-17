import React, { useState, useEffect } from 'react'
import { Layout, Menu, Avatar, Dropdown, Badge, Button, Space } from 'antd'
import { useNavigate, useLocation, Outlet } from 'react-router-dom'
import {
  DashboardOutlined,
  BookOutlined,
  FileTextOutlined,
  ProfileOutlined,
  UserOutlined,
  BellOutlined,
  TeamOutlined,
  BarChartOutlined,
  SettingOutlined,
  UnorderedListOutlined,
  TrophyOutlined,
  FileSearchOutlined,
  LogoutOutlined
} from '@ant-design/icons'
import request from '../utils/request'
import eventBus from '../utils/eventBus'

const { Header, Sider, Content } = Layout

const getMenus = (role, unreadCount) => {
  const notificationLabel = unreadCount > 0 ? (
    <Space>
      消息通知
      <Badge count={unreadCount} size="small" />
    </Space>
  ) : '消息通知'

  const allMenus = {
    employee: [
      { key: '/dashboard', icon: <DashboardOutlined />, label: '工作台' },
      { key: '/my-courses', icon: <BookOutlined />, label: '我的培训' },
      { key: '/my-exams', icon: <FileTextOutlined />, label: '我的考试' },
      { key: '/my-certificates', icon: <TrophyOutlined />, label: '我的证书' },
      { key: '/my-skill-profile', icon: <ProfileOutlined />, label: '我的技能档案' },
      { key: '/notifications', icon: <BellOutlined />, label: notificationLabel }
    ],
    supervisor: [
      { key: '/dashboard', icon: <DashboardOutlined />, label: '工作台' },
      { key: '/approvals', icon: <UnorderedListOutlined />, label: '报名审批' },
      { key: '/courses', icon: <BookOutlined />, label: '课程管理' },
      { key: '/exams', icon: <FileTextOutlined />, label: '考试管理' },
      { key: '/certificates', icon: <TrophyOutlined />, label: '证书管理' },
      { key: '/reports', icon: <BarChartOutlined />, label: '培训统计' },
      { key: '/notifications', icon: <BellOutlined />, label: notificationLabel }
    ],
    trainer: [
      { key: '/dashboard', icon: <DashboardOutlined />, label: '工作台' },
      { key: '/courses', icon: <BookOutlined />, label: '课程管理' },
      { key: '/enrollments', icon: <UnorderedListOutlined />, label: '报名管理' },
      { key: '/exams', icon: <FileTextOutlined />, label: '考试管理' },
      { key: '/certificates', icon: <TrophyOutlined />, label: '证书管理' },
      { key: '/reports', icon: <BarChartOutlined />, label: '培训统计' },
      { key: '/users', icon: <TeamOutlined />, label: '用户管理' },
      { key: '/logs', icon: <FileSearchOutlined />, label: '操作日志' },
      { key: '/notifications', icon: <BellOutlined />, label: notificationLabel }
    ]
  }
  return allMenus[role] || allMenus.employee
}

export default function MainLayout({ onLogout }) {
  const navigate = useNavigate()
  const location = useLocation()
  const [collapsed, setCollapsed] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const user = JSON.parse(localStorage.getItem('user') || '{}')
  const menus = getMenus(user.role, unreadCount)

  useEffect(() => {
    const fetchUnread = async () => {
      try {
        const res = await request.get('/notifications/unread-count')
        setUnreadCount(res.data?.count || 0)
      } catch (e) {}
    }
    
    const handleUnreadUpdate = (count) => {
      setUnreadCount(count ?? 0)
    }
    
    fetchUnread()
    eventBus.on('unreadCountUpdated', handleUnreadUpdate)
    const timer = setInterval(fetchUnread, 60000)
    return () => {
      clearInterval(timer)
      eventBus.off('unreadCountUpdated', handleUnreadUpdate)
    }
  }, [])

  const handleLogout = async () => {
    try { await request.post('/auth/logout') } catch (e) {}
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    onLogout?.()
    navigate('/login')
  }

  const userMenu = {
    items: [
      { key: 'profile', icon: <UserOutlined />, label: '个人信息' },
      { type: 'divider' },
      { key: 'logout', icon: <LogoutOutlined />, label: '退出登录', onClick: handleLogout }
    ]
  }

  const roleNames = { employee: '普通员工', supervisor: '部门主管', trainer: '培训管理员' }

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider trigger={null} collapsible collapsed={collapsed} theme="dark" style={{ background: '#001529' }}>
        <div style={{ height: 64, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: collapsed ? 14 : 18, fontWeight: 600, background: '#002140' }}>
          {collapsed ? '培训' : '培训认证管理系统'}
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[location.pathname]}
          items={menus}
          onClick={({ key }) => navigate(key)}
          style={{ borderRight: 0 }}
        />
      </Sider>
      <Layout>
        <Header style={{ background: '#fff', padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', boxShadow: '0 1px 4px rgba(0,21,41,0.08)' }}>
          <Button type="text" icon={collapsed ? <SettingOutlined rotate={90} /> : <SettingOutlined />} onClick={() => setCollapsed(!collapsed)} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <Badge count={unreadCount} onClick={() => navigate('/notifications')}>
              <Button type="text" icon={<BellOutlined />} size="large" />
            </Badge>
            <Dropdown menu={userMenu} placement="bottomRight">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                <Avatar icon={<UserOutlined />} style={{ background: '#2c5aa0' }} />
                <span style={{ color: '#1f1f1f' }}>{user.name}</span>
                <span style={{ color: '#888', fontSize: 12 }}>({roleNames[user.role] || user.role})</span>
              </div>
            </Dropdown>
          </div>
        </Header>
        <Content style={{ margin: 0, minHeight: 280 }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  )
}

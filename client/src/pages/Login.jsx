import React from 'react'
import { Form, Input, Button, Card, message } from 'antd'
import { UserOutlined, LockOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import request from '../utils/request'

export default function Login({ onLogin }) {
  const navigate = useNavigate()
  const [loading, setLoading] = React.useState(false)

  const onFinish = async (values) => {
    setLoading(true)
    try {
      const res = await request.post('/auth/login', values)
      localStorage.setItem('token', res.data.token)
      localStorage.setItem('user', JSON.stringify(res.data.user))
      message.success('登录成功')
      onLogin?.()
      navigate('/dashboard')
    } catch (e) {
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-container">
      <Card className="login-box" bordered={false}>
        <h2 className="login-title">企业员工技能培训</h2>
        <p className="login-subtitle">与认证管理系统</p>
        <Form name="login" onFinish={onFinish} autoComplete="off" size="large">
          <Form.Item name="username" rules={[{ required: true, message: '请输入用户名' }]}>
            <Input prefix={<UserOutlined />} placeholder="用户名" />
          </Form.Item>
          <Form.Item name="password" rules={[{ required: true, message: '请输入密码' }]}>
            <Input.Password prefix={<LockOutlined />} placeholder="密码" />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" block loading={loading}>登 录</Button>
          </Form.Item>
        </Form>
        <div style={{ marginTop: 16, fontSize: 12, color: '#999', textAlign: 'center' }}>
          <p>测试账号：</p>
          <p>管理员 admin / admin123</p>
          <p>主管 supervisor1 / super123</p>
          <p>员工 emp001 / emp123</p>
        </div>
      </Card>
    </div>
  )
}

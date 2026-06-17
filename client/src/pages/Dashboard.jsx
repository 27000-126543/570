import React, { useState, useEffect } from 'react'
import { Row, Col, Card, List, Tag, Button, message } from 'antd'
import {
  BookOutlined,
  FileTextOutlined,
  TrophyOutlined,
  BellOutlined,
  ArrowRightOutlined
} from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import request from '../utils/request'
import ReactECharts from 'echarts-for-react'

const statusMap = {
  pending: { text: '待审批', color: 'orange' },
  approved: { text: '已通过', color: 'blue' },
  rejected: { text: '已拒绝', color: 'red' },
  completed: { text: '已完成', color: 'green' },
  cancelled: { text: '已取消', color: 'default' },
  escalated: { text: '超时升级', color: 'red' }
}

export default function Dashboard() {
  const navigate = useNavigate()
  const user = JSON.parse(localStorage.getItem('user') || '{}')
  const [stats, setStats] = useState({ courses: 0, exams: 0, certs: 0, notifs: 0 })
  const [recentCourses, setRecentCourses] = useState([])
  const [recentNotifs, setRecentNotifs] = useState([])
  const [summaryData, setSummaryData] = useState(null)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      const [coursesRes, notifsRes] = await Promise.all([
        request.get('/courses', { params: { pageSize: 5, page: 1 } }),
        request.get('/notifications/my', { params: { unread: 1, pageSize: 5 } })
      ])
      setRecentCourses(coursesRes.data?.list || [])
      setRecentNotifs(notifsRes.data?.list || [])

      if (user.role === 'employee') {
        const [myCourses, myExams, myCerts] = await Promise.all([
          request.get('/enrollments/my'),
          request.get('/exams/records/my'),
          request.get('/certificates/my')
        ])
        setStats({
          courses: myCourses.data?.total || 0,
          exams: myExams.data?.length || 0,
          certs: myCerts.data?.length || 0,
          notifs: notifsRes.data?.unreadCount || 0
        })
      } else {
        const reportsRes = await request.get('/reports/summary').catch(() => ({}))
        setSummaryData(reportsRes.data)
        setStats({
          courses: coursesRes.data?.total || 0,
          exams: 0,
          certs: 0,
          notifs: notifsRes.data?.unreadCount || 0
        })
      }
    } catch (e) {}
  }

  const getChartOption = () => ({
    tooltip: { trigger: 'axis' },
    legend: { data: ['完成率(%)', '合格率(%)'] },
    xAxis: { type: 'category', data: summaryData?.departments?.map(d => d.department) || [] },
    yAxis: { type: 'value', max: 100 },
    series: [
      { name: '完成率(%)', type: 'bar', data: summaryData?.departments?.map(d => d.completionRate) || [] },
      { name: '合格率(%)', type: 'bar', data: summaryData?.departments?.map(d => d.passRate) || [] }
    ]
  })

  const getPieOption = () => ({
    tooltip: { trigger: 'item' },
    series: [{
      type: 'pie', radius: ['40%', '70%'],
      data: [
        { value: summaryData?.overall?.enrollmentCount || 0, name: '培训人次' },
        { value: summaryData?.overall?.examCount || 0, name: '考试人次' },
        { value: summaryData?.overall?.certificateCount || 0, name: '证书发放' }
      ]
    }]
  })

  const markRead = async (id) => {
    try {
      await request.post(`/notifications/${id}/read`)
      loadData()
    } catch (e) {}
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <h2 className="page-title">工作台</h2>
        <span>欢迎回来，{user.name}！今天是 {new Date().toLocaleDateString('zh-CN')}</span>
      </div>

      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={12} md={6}>
          <Card className="stat-card">
            <BookOutlined style={{ fontSize: 24 }} />
            <div className="stat-value">{stats.courses}</div>
            <div className="stat-label">{user.role === 'employee' ? '我的培训课程' : '课程总数'}</div>
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card className="stat-card" style={{ background: 'linear-gradient(135deg, #1890ff 0%, #096dd9 100%)' }}>
            <FileTextOutlined style={{ fontSize: 24 }} />
            <div className="stat-value">{stats.exams}</div>
            <div className="stat-label">{user.role === 'employee' ? '考试记录' : '考试管理'}</div>
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card className="stat-card" style={{ background: 'linear-gradient(135deg, #52c41a 0%, #389e0d 100%)' }}>
            <TrophyOutlined style={{ fontSize: 24 }} />
            <div className="stat-value">{stats.certs}</div>
            <div className="stat-label">{user.role === 'employee' ? '我的证书' : '证书管理'}</div>
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card className="stat-card" style={{ background: 'linear-gradient(135deg, #faad14 0%, #d48806 100%)' }}>
            <BellOutlined style={{ fontSize: 24 }} />
            <div className="stat-value">{stats.notifs}</div>
            <div className="stat-label">未读消息</div>
          </Card>
        </Col>
      </Row>

      {user.role !== 'employee' && summaryData && (
        <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
          <Col md={14}>
            <Card title="各部门培训数据对比" extra={<Button type="link" onClick={() => navigate('/reports/summary')}>查看详情 <ArrowRightOutlined /></Button>}>
              <ReactECharts option={getChartOption()} style={{ height: 300 }} />
            </Card>
          </Col>
          <Col md={10}>
            <Card title="本月总体数据">
              <ReactECharts option={getPieOption()} style={{ height: 300 }} />
              <Row gutter={16} style={{ marginTop: 16 }}>
                <Col span={8}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 24, color: '#2c5aa0', fontWeight: 600 }}>{summaryData.overall?.completionRate || 0}%</div>
                    <div style={{ color: '#888', fontSize: 12 }}>整体完成率</div>
                  </div>
                </Col>
                <Col span={8}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 24, color: '#1890ff', fontWeight: 600 }}>{summaryData.overall?.passRate || 0}%</div>
                    <div style={{ color: '#888', fontSize: 12 }}>整体合格率</div>
                  </div>
                </Col>
                <Col span={8}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 24, color: '#52c41a', fontWeight: 600 }}>{summaryData.overall?.certificateCount || 0}</div>
                    <div style={{ color: '#888', fontSize: 12 }}>证书发放</div>
                  </div>
                </Col>
              </Row>
            </Card>
          </Col>
        </Row>
      )}

      <Row gutter={[16, 16]}>
        <Col md={user.role === 'employee' ? 24 : 14}>
          <Card title="最新课程" extra={<Button type="link" onClick={() => navigate(user.role === 'employee' ? '/my-courses' : '/courses')}>更多 <ArrowRightOutlined /></Button>}>
            <List
              dataSource={recentCourses}
              renderItem={item => (
                <List.Item
                  key={item.id}
                  actions={[
                    <Button type="link" onClick={() => navigate(user.role === 'employee' ? `/courses/${item.id}` : `/courses/${item.id}/edit`)}>
                      查看
                    </Button>
                  ]}
                >
                  <List.Item.Meta
                    title={<span>{item.name} <Tag color="blue">{item.code}</Tag></span>}
                    description={
                      <span>
                        {item.category} · {item.hours}学时 · 讲师：{item.teacher || '待定'}
                        <br />
                        时间：{item.start_date} 至 {item.end_date}
                        <span style={{ marginLeft: 16 }}>已报名：{item.enrolled_count || 0}/{item.capacity}</span>
                      </span>
                    }
                  />
                </List.Item>
              )}
            />
          </Card>
        </Col>

        <Col md={10}>
          <Card title="消息通知" extra={<Button type="link" onClick={() => navigate('/notifications')}>全部 <ArrowRightOutlined /></Button>}>
            <List
              dataSource={recentNotifs}
              locale={{ emptyText: '暂无未读消息' }}
              renderItem={item => (
                <List.Item key={item.id} onClick={() => markRead(item.id)} style={{ cursor: 'pointer' }}>
                  <List.Item.Meta
                    title={item.title}
                    description={<span style={{ color: item.read ? '#888' : '#1890ff' }}>{item.content}</span>}
                  />
                </List.Item>
              )}
            />
          </Card>
        </Col>
      </Row>
    </div>
  )
}

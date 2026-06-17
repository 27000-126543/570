import React, { useState, useEffect } from 'react'
import { Card, Tag, Table, Descriptions, Row, Col, Spin, Empty } from 'antd'
import { UserOutlined, TrophyOutlined, HistoryOutlined } from '@ant-design/icons'
import request from '../../utils/request'

const statusMap = {
  pending: { text: '待审批', color: 'orange' },
  approved: { text: '已通过', color: 'blue' },
  rejected: { text: '已拒绝', color: 'red' },
  completed: { text: '已完成', color: 'green' },
  escalated: { text: '超时升级', color: 'red' }
}

const levelMap = {
  advanced: { text: '高级', color: 'green' },
  intermediate: { text: '中级', color: 'orange' },
  beginner: { text: '初级', color: 'blue' }
}

const user = JSON.parse(localStorage.getItem('user') || '{}')

export default function MySkillProfile() {
  const [loading, setLoading] = useState(false)
  const [profile, setProfile] = useState({
    skills: [],
    trainingHistory: [],
    certificates: []
  })

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    try {
      const res = await request.get('/skill-profile/my')
      setProfile(res.data || { skills: [], trainingHistory: [], certificates: [] })
    } finally {
      setLoading(false)
    }
  }

  const historyColumns = [
    { title: '课程名称', dataIndex: 'course_name', key: 'course_name' },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: s => <Tag color={statusMap[s]?.color}>{statusMap[s]?.text}</Tag>
    },
    { title: '成绩', dataIndex: 'exam_score', key: 'exam_score', width: 80, render: s => s || '-' },
    {
      title: '是否通过',
      dataIndex: 'exam_passed',
      key: 'exam_passed',
      width: 100,
      render: p => {
        if (p === null || p === undefined) return '-'
        return <Tag color={p ? 'green' : 'red'}>{p ? '已通过' : '未通过'}</Tag>
      }
    },
    { title: '培训时间', dataIndex: 'apply_time', key: 'apply_time', width: 160 }
  ]

  if (loading) {
    return (
      <div className="page-container">
        <div className="page-header">
          <h2 className="page-title">我的技能档案</h2>
        </div>
        <div style={{ textAlign: 'center', padding: '60px 0' }}>
          <Spin size="large" />
        </div>
      </div>
    )
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <h2 className="page-title">我的技能档案</h2>
      </div>

      <Row gutter={[24, 24]}>
        <Col xs={24} lg={8}>
          <Card title={<span><UserOutlined style={{ marginRight: 8 }} />基本信息</span>}>
            <Descriptions column={1} bordered size="small">
              <Descriptions.Item label="姓名">{user.name}</Descriptions.Item>
              <Descriptions.Item label="部门">{user.department}</Descriptions.Item>
              <Descriptions.Item label="职位">{user.position}</Descriptions.Item>
              <Descriptions.Item label="总学时">
                <span style={{ color: '#1890ff', fontWeight: 'bold', fontSize: 18 }}>
                  {user.total_hours || 0}
                </span> 学时
              </Descriptions.Item>
              <Descriptions.Item label="已获证书">
                <span style={{ color: '#52c41a', fontWeight: 'bold', fontSize: 18 }}>
                  {profile.certificates?.filter(c => c.valid).length || 0}
                </span> 张
              </Descriptions.Item>
            </Descriptions>
          </Card>
        </Col>

        <Col xs={24} lg={16}>
          <Card title={<span><TrophyOutlined style={{ marginRight: 8 }} />技能标签</span>}>
            {profile.skills?.length === 0 ? (
              <Empty description="暂无技能标签" />
            ) : (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                {profile.skills.map(skill => (
                  <Tag
                    key={skill.id}
                    color={levelMap[skill.level]?.color}
                    style={{
                      fontSize: 14,
                      padding: '6px 16px',
                      borderRadius: 16,
                      margin: 0
                    }}
                  >
                    {skill.skill_name}
                    <span style={{ marginLeft: 8, opacity: 0.85 }}>
                      {levelMap[skill.level]?.text}
                    </span>
                    {skill.score !== null && skill.score !== undefined && (
                      <span style={{ marginLeft: 8, opacity: 0.7 }}>
                        {skill.score}分
                      </span>
                    )}
                  </Tag>
                ))}
              </div>
            )}
          </Card>
        </Col>

        <Col xs={24}>
          <Card title={<span><HistoryOutlined style={{ marginRight: 8 }} />培训历史</span>}>
            <Table
              columns={historyColumns}
              dataSource={profile.trainingHistory}
              rowKey="id"
              pagination={{
                showSizeChanger: true,
                showQuickJumper: true,
                showTotal: t => `共 ${t} 条`
              }}
            />
          </Card>
        </Col>
      </Row>
    </div>
  )
}

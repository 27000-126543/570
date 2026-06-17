import React, { useState, useEffect } from 'react'
import { Table, Button, Tag, Card, Tabs, message, Modal, Descriptions } from 'antd'
import { PlayCircleOutlined, EyeOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import request from '../../utils/request'

export default function MyExams() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [recordLoading, setRecordLoading] = useState(false)
  const [examList, setExamList] = useState([])
  const [recordList, setRecordList] = useState([])
  const [activeTab, setActiveTab] = useState('available')
  const [detailModal, setDetailModal] = useState({ open: false, record: null })

  useEffect(() => {
    if (activeTab === 'available') {
      loadAvailableExams()
    } else {
      loadExamRecords()
    }
  }, [activeTab])

  const loadAvailableExams = async () => {
    setLoading(true)
    try {
      const res = await request.get('/exams', { params: { status: 'active' } })
      setExamList(res.data || [])
    } finally {
      setLoading(false)
    }
  }

  const loadExamRecords = async () => {
    setRecordLoading(true)
    try {
      const res = await request.get('/exams/records/my')
      setRecordList(res.data || [])
    } finally {
      setRecordLoading(false)
    }
  }

  const handleStartExam = async (examId) => {
    try {
      const res = await request.post(`/exams/${examId}/start`)
      message.success(res.message || '开始考试')
      navigate(`/exams/${examId}/take?recordId=${res.data.recordId}`)
    } catch (e) {}
  }

  const handleViewRecord = (record) => {
    setDetailModal({ open: true, record })
  }

  const availableColumns = [
    { title: '考试名称', dataIndex: 'name', key: 'name' },
    { title: '课程名称', dataIndex: 'course_name', key: 'course_name' },
    { title: '时长(分钟)', dataIndex: 'duration', key: 'duration', width: 100 },
    { title: '总分', dataIndex: 'total_score', key: 'total_score', width: 80 },
    { title: '及格分', dataIndex: 'pass_score', key: 'pass_score', width: 80 },
    {
      title: '操作',
      key: 'action',
      width: 120,
      render: (_, r) => (
        <Button type="primary" icon={<PlayCircleOutlined />} onClick={() => handleStartExam(r.id)}>
          开始考试
        </Button>
      )
    }
  ]

  const recordColumns = [
    { title: '考试名称', dataIndex: 'exam_name', key: 'exam_name' },
    { title: '课程名称', dataIndex: 'course_name', key: 'course_name' },
    { title: '得分', dataIndex: 'score', key: 'score', width: 80 },
    {
      title: '是否通过',
      dataIndex: 'passed',
      key: 'passed',
      width: 100,
      render: p => (
        <Tag color={p ? 'green' : 'red'}>
          {p ? '已通过' : '未通过'}
        </Tag>
      )
    },
    { title: '用时(分钟)', dataIndex: 'duration_used', key: 'duration_used', width: 100 },
    { title: '提交时间', dataIndex: 'submit_time', key: 'submit_time', width: 160 },
    {
      title: '操作',
      key: 'action',
      width: 100,
      render: (_, r) => (
        <Button type="link" icon={<EyeOutlined />} onClick={() => handleViewRecord(r)}>
          详情
        </Button>
      )
    }
  ]

  const tabItems = [
    { key: 'available', label: '可参加考试' },
    { key: 'record', label: '考试记录' }
  ]

  return (
    <div className="page-container">
      <div className="page-header">
        <h2 className="page-title">我的考试</h2>
      </div>

      <Card>
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={tabItems}
        />

        {activeTab === 'available' && (
          <Table
            loading={loading}
            columns={availableColumns}
            dataSource={examList}
            rowKey="id"
            pagination={{
              showSizeChanger: true,
              showQuickJumper: true,
              showTotal: t => `共 ${t} 条`
            }}
          />
        )}

        {activeTab === 'record' && (
          <Table
            loading={recordLoading}
            columns={recordColumns}
            dataSource={recordList}
            rowKey="id"
            pagination={{
              showSizeChanger: true,
              showQuickJumper: true,
              showTotal: t => `共 ${t} 条`
            }}
          />
        )}
      </Card>

      <Modal
        title="考试记录详情"
        open={detailModal.open}
        onCancel={() => setDetailModal({ open: false, record: null })}
        footer={[
          <Button key="close" onClick={() => setDetailModal({ open: false, record: null })}>关闭</Button>
        ]}
        width={600}
      >
        {detailModal.record && (
          <Descriptions column={1} bordered size="small">
            <Descriptions.Item label="考试名称">{detailModal.record.exam_name}</Descriptions.Item>
            <Descriptions.Item label="课程名称">{detailModal.record.course_name}</Descriptions.Item>
            <Descriptions.Item label="得分">
              <span style={{ fontSize: 20, fontWeight: 'bold', color: detailModal.record.passed ? '#52c41a' : '#ff4d4f' }}>
                {detailModal.record.score}
              </span> 分
            </Descriptions.Item>
            <Descriptions.Item label="是否通过">
              <Tag color={detailModal.record.passed ? 'green' : 'red'}>
                {detailModal.record.passed ? '已通过' : '未通过'}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="用时">{detailModal.record.duration_used} 分钟</Descriptions.Item>
            <Descriptions.Item label="开始时间">{detailModal.record.start_time}</Descriptions.Item>
            <Descriptions.Item label="提交时间">{detailModal.record.submit_time}</Descriptions.Item>
          </Descriptions>
        )}
      </Modal>
    </div>
  )
}
